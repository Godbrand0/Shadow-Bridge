import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { ShadowBridgeETH, MockUSDC, MockCCTPTokenMessenger } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

const CLEAR_AMOUNT = 100_000_000n; // 100 USDC (6 decimals)

async function deployFixture() {
  const signers: HardhatEthersSigner[] = await ethers.getSigners();

  const mockUSDC = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
  const usdcAddress = await mockUSDC.getAddress();

  const mockCCTP = (await (
    await ethers.getContractFactory("MockCCTPTokenMessenger")
  ).deploy(usdcAddress)) as MockCCTPTokenMessenger;
  const cctpAddress = await mockCCTP.getAddress();

  // Placeholder Base bridge address — doesn't need to be real for ETH-side tests
  const baseBridgePlaceholder = signers[5].address;

  const bridge = (await (
    await ethers.getContractFactory("ShadowBridgeETH")
  ).deploy(usdcAddress, cctpAddress, baseBridgePlaceholder)) as ShadowBridgeETH;
  const bridgeAddress = await bridge.getAddress();

  return { bridge, bridgeAddress, mockUSDC, usdcAddress, mockCCTP, cctpAddress };
}

describe("ShadowBridgeETH", function () {
  let signers: Signers;
  let bridge: ShadowBridgeETH;
  let bridgeAddress: string;
  let mockUSDC: MockUSDC;
  let mockCCTP: MockCCTPTokenMessenger;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
    ({ bridge, bridgeAddress, mockUSDC, mockCCTP } = await deployFixture());
  });

  // ---------------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------------

  it("deploys with correct immutables", async function () {
    expect(await bridge.usdcToken()).to.eq(await mockUSDC.getAddress());
    expect(await bridge.cctpMessenger()).to.eq(await mockCCTP.getAddress());
    expect(await bridge.BASE_DOMAIN()).to.eq(6);
    expect(await bridge.ARBITRUM_DOMAIN()).to.eq(3);
  });

  it("pre-registers Base destination and allows owner to register Arbitrum", async function () {
    const baseBridge = await bridge.destinations(6);
    expect(baseBridge).to.not.eq(ethers.ZeroHash);

    // Register a mock Arbitrum destination
    const arbBridge = signers.bob.address;
    await bridge.connect(signers.deployer).registerDestination(3, arbBridge);
    const stored = await bridge.destinations(3);
    expect(stored).to.eq(ethers.zeroPadValue(arbBridge, 32));
  });

  it("reverts depositConfidential for an unregistered destination", async function () {
    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);

    await expect(
      bridge.connect(signers.alice).depositConfidential(input.handles[0], input.inputProof, 3),
    ).to.be.revertedWith("ShadowBridgeETH: unknown destination");
  });

  it("bridges to Arbitrum when destination domain 3 is registered", async function () {
    // Register mock Arbitrum destination
    const arbBridgePlaceholder = signers.bob.address;
    await bridge.connect(signers.deployer).registerDestination(3, arbBridgePlaceholder);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);

    await (
      await bridge.connect(signers.alice).depositConfidential(input.handles[0], input.inputProof, 3)
    ).wait();

    const handle = await bridge.getDepositHandle(signers.alice.address);
    const decryptResult = await fhevm.publicDecrypt([handle]);

    const callbackTx = await bridge.onDecryptCallback(
      [handle],
      decryptResult.abiEncodedClearValues,
      decryptResult.decryptionProof,
    );

    // BridgeExecuted should emit domain 3 (Arbitrum)
    await expect(callbackTx)
      .to.emit(bridge, "BridgeExecuted")
      .withArgs(signers.alice.address, 3);
  });

  // ---------------------------------------------------------------------------
  // depositConfidential
  // ---------------------------------------------------------------------------

  it("emits DepositReceived and sets hasPendingBridge on valid deposit", async function () {
    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);

    const tx = await bridge
      .connect(signers.alice)
      .depositConfidential(input.handles[0], input.inputProof, 6);

    await expect(tx).to.emit(bridge, "DepositReceived").withArgs(signers.alice.address);
    expect(await bridge.hasPendingBridge(signers.alice.address)).to.be.true;
  });

  it("stores a non-zero deposit handle after depositConfidential", async function () {
    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);

    await (
      await bridge.connect(signers.alice).depositConfidential(input.handles[0], input.inputProof, 6)
    ).wait();

    const handle = await bridge.getDepositHandle(signers.alice.address);
    expect(handle).to.not.eq(ethers.ZeroHash);
  });

  it("reverts if depositConfidential is called while a bridge is pending", async function () {
    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT * 2n);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT * 2n);

    await (
      await bridge.connect(signers.alice).depositConfidential(input.handles[0], input.inputProof, 6)
    ).wait();

    const input2 = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await expect(
      bridge.connect(signers.alice).depositConfidential(input2.handles[0], input2.inputProof, 6),
    ).to.be.revertedWith("ShadowBridgeETH: bridge already pending");
  });

  // ---------------------------------------------------------------------------
  // Full flow: depositConfidential → onDecryptCallback → BridgeExecuted
  // ---------------------------------------------------------------------------

  it("full flow: deposit → decrypt callback → CCTP burn", async function () {
    // ---- 1. Encrypt amount and deposit ----
    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);

    await (
      await bridge.connect(signers.alice).depositConfidential(input.handles[0], input.inputProof, 6)
    ).wait();

    // ---- 2. Simulate off-chain relayer: publicDecrypt ----
    const handle = await bridge.getDepositHandle(signers.alice.address);
    const decryptResult = await fhevm.publicDecrypt([handle]);

    // Verify the mock decrypted the right amount (sanity check)
    const decryptedAmount: bigint = decryptResult.clearValues[handle as `0x${string}`] as bigint;
    expect(decryptedAmount).to.eq(CLEAR_AMOUNT);

    // ---- 3. Submit decrypt callback ----
    const callbackTx = await bridge.onDecryptCallback(
      [handle],
      decryptResult.abiEncodedClearValues,
      decryptResult.decryptionProof,
    );

    await expect(callbackTx)
      .to.emit(bridge, "BridgeExecuted")
      .withArgs(signers.alice.address, 6);

    // ---- 4. Verify state cleanup ----
    expect(await bridge.hasPendingBridge(signers.alice.address)).to.be.false;

    // USDC should have moved: alice → bridge → mock CCTP
    expect(await mockUSDC.balanceOf(signers.alice.address)).to.eq(0n);
    expect(await mockUSDC.balanceOf(await mockCCTP.getAddress())).to.eq(CLEAR_AMOUNT);

    // Handle should be cleared
    const handleAfter = await bridge.getDepositHandle(signers.alice.address);
    expect(handleAfter).to.eq(ethers.ZeroHash);
  });

  // ---------------------------------------------------------------------------
  // Two independent users can deposit concurrently
  // ---------------------------------------------------------------------------

  it("two users can have independent pending deposits", async function () {
    await mockUSDC.mint(signers.alice.address, CLEAR_AMOUNT);
    await mockUSDC.mint(signers.bob.address, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, CLEAR_AMOUNT);
    await mockUSDC.connect(signers.bob).approve(bridgeAddress, CLEAR_AMOUNT);

    const inputAlice = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();
    const inputBob = await fhevm
      .createEncryptedInput(bridgeAddress, signers.bob.address)
      .add64(CLEAR_AMOUNT)
      .encrypt();

    await (
      await bridge.connect(signers.alice).depositConfidential(inputAlice.handles[0], inputAlice.inputProof, 6)
    ).wait();
    await (
      await bridge.connect(signers.bob).depositConfidential(inputBob.handles[0], inputBob.inputProof, 6)
    ).wait();

    expect(await bridge.hasPendingBridge(signers.alice.address)).to.be.true;
    expect(await bridge.hasPendingBridge(signers.bob.address)).to.be.true;

    const handleAlice = await bridge.getDepositHandle(signers.alice.address);
    const handleBob = await bridge.getDepositHandle(signers.bob.address);
    expect(handleAlice).to.not.eq(handleBob);
  });
});
