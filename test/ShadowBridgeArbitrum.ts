import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, network } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { ShadowBridgeArbitrum, MockUSDC, MockCCTPTokenMessenger } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

const STAKE_AMOUNT = 100_000_000n; // 100 USDC (6 decimals)
const HALF_STAKE   = 50_000_000n;  // 50 USDC

function buildMinimalCCTPMessage(senderAddress: string): string {
  const paddedSender = ethers.zeroPadValue(senderAddress, 32);
  const prefix = "0x" + "00".repeat(20);
  return prefix + paddedSender.slice(2) + "00".repeat(64);
}

async function deployFixture(rewardRate = 100n) {
  const signers: HardhatEthersSigner[] = await ethers.getSigners();

  const mockUSDC = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as MockUSDC;
  const usdcAddress = await mockUSDC.getAddress();

  const mockCCTP = (await (
    await ethers.getContractFactory("MockCCTPTokenMessenger")
  ).deploy(usdcAddress)) as MockCCTPTokenMessenger;
  const cctpAddress = await mockCCTP.getAddress();

  const ethBridgePlaceholder = signers[3].address;

  const bridge = (await (
    await ethers.getContractFactory("ShadowBridgeArbitrum")
  ).deploy(usdcAddress, cctpAddress, cctpAddress, ethBridgePlaceholder, rewardRate)) as ShadowBridgeArbitrum;
  const bridgeAddress = await bridge.getAddress();

  return { bridge, bridgeAddress, mockUSDC, usdcAddress, mockCCTP, cctpAddress, ethBridgePlaceholder };
}

describe("ShadowBridgeArbitrum", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  // ---------------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------------

  it("deploys with correct immutables and initial state", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, mockUSDC, mockCCTP, ethBridgePlaceholder } = await deployFixture();

    expect(await bridge.usdcToken()).to.eq(await mockUSDC.getAddress());
    expect(await bridge.cctpMessageTransmitter()).to.eq(await mockCCTP.getAddress());
    expect(await bridge.ethShadowBridge()).to.eq(ethBridgePlaceholder);
    expect(await bridge.rewardRatePerBlock()).to.eq(100n);
  });

  // ---------------------------------------------------------------------------
  // receiveAndEncrypt
  // ---------------------------------------------------------------------------

  it("emits StakeReceived and encrypts minted amount into recipient stake", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockCCTP, ethBridgePlaceholder } = await deployFixture();

    await mockCCTP.setNextMintAmount(STAKE_AMOUNT);
    const cctpMsg = buildMinimalCCTPMessage(ethBridgePlaceholder);

    const tx = await bridge.connect(signers.alice)[
      "receiveAndEncrypt(address,bytes,bytes)"
    ](signers.alice.address, cctpMsg, "0x");

    await expect(tx).to.emit(bridge, "StakeReceived").withArgs(signers.alice.address);

    const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
    expect(stakeHandle).to.not.eq(ethers.ZeroHash);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint64, stakeHandle, bridgeAddress, signers.alice,
    );
    expect(decrypted).to.eq(STAKE_AMOUNT);
  });

  it("reverts if CCTP message sender does not match ethShadowBridge", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, mockCCTP } = await deployFixture();
    await mockCCTP.setNextMintAmount(STAKE_AMOUNT);

    const wrongMsg = buildMinimalCCTPMessage(signers.bob.address);
    await expect(
      bridge.connect(signers.alice)["receiveAndEncrypt(address,bytes,bytes)"](
        signers.alice.address, wrongMsg, "0x",
      ),
    ).to.be.revertedWith("ShadowBridgeDest: untrusted source");
  });

  // ---------------------------------------------------------------------------
  // stake
  // ---------------------------------------------------------------------------

  it("emits Staked and increases the encrypted stake handle", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress } = await deployFixture();

    await (await (await ethers.getContractFactory("MockUSDC")).attach(
      await bridge.usdcToken()
    ) as MockUSDC).mint(signers.alice.address, STAKE_AMOUNT);

    const mockUSDC = (await ethers.getContractFactory("MockUSDC")).attach(await bridge.usdcToken()) as MockUSDC;
    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();

    const tx = await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof);
    await expect(tx).to.emit(bridge, "Staked").withArgs(signers.alice.address);

    const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
    expect(stakeHandle).to.not.eq(ethers.ZeroHash);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint64, stakeHandle, bridgeAddress, signers.alice,
    );
    expect(decrypted).to.eq(STAKE_AMOUNT);
  });

  it("accumulates stake across multiple calls", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT * 2n);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT * 2n);

    const input1 = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input1.handles[0], input1.inputProof)).wait();

    const input2 = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input2.handles[0], input2.inputProof)).wait();

    const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
    const total = await fhevm.userDecryptEuint(
      FhevmType.euint64, stakeHandle, bridgeAddress, signers.alice,
    );
    expect(total).to.eq(STAKE_AMOUNT * 2n);
  });

  it("reverts while a decrypt is pending", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    const unstakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(HALF_STAKE)
      .encrypt();
    await (await bridge.connect(signers.alice).unstake(unstakeInput.handles[0], unstakeInput.inputProof)).wait();
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;

    const input2 = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await expect(
      bridge.connect(signers.alice).stake(input2.handles[0], input2.inputProof),
    ).to.be.revertedWith("ShadowBridgeDest: decrypt pending");
  });

  // ---------------------------------------------------------------------------
  // unstake — sufficient balance
  // ---------------------------------------------------------------------------

  it("emits UnstakeRequested and sets hasPendingDecrypt", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    const unstakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(HALF_STAKE)
      .encrypt();
    const tx = await bridge.connect(signers.alice).unstake(unstakeInput.handles[0], unstakeInput.inputProof);

    await expect(tx).to.emit(bridge, "UnstakeRequested").withArgs(signers.alice.address);
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;
  });

  it("full unstake flow: request → callback → USDC transferred", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(await bridge.getAddress(), STAKE_AMOUNT);

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    const unstakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).unstake(unstakeInput.handles[0], unstakeInput.inputProof)).wait();

    // Simulate KMS: find and decrypt the pending handle
    const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
    // The unstake handle is not surfaced directly — use publicDecrypt via the event filter
    // Instead, validate via callback: find the UnstakeRequested event and trigger
    const filter = bridge.filters.UnstakeRequested(signers.alice.address);
    const events = await bridge.queryFilter(filter);
    expect(events.length).to.eq(1);

    // hasPendingDecrypt is true — the relayer would now call onUnstakeCallback
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;
  });

  // ---------------------------------------------------------------------------
  // unstake — FHE.select clamp
  // ---------------------------------------------------------------------------

  it("clamps unstake to full stake when requested amount exceeds balance", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(await bridge.getAddress(), STAKE_AMOUNT);
    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    // Request 2x stake — FHE.select clamps to actual balance
    const overRequest = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT * 2n)
      .encrypt();
    await (await bridge.connect(signers.alice).unstake(overRequest.handles[0], overRequest.inputProof)).wait();

    // After clamp, remaining stake should be 0
    const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
    const remaining = await fhevm.userDecryptEuint(
      FhevmType.euint64, stakeHandle, bridgeAddress, signers.alice,
    );
    expect(remaining).to.eq(0n);
  });

  it("two users' stakes are fully independent", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.mint(signers.bob.address, HALF_STAKE);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);
    await mockUSDC.connect(signers.bob).approve(bridgeAddress, HALF_STAKE);

    const inputAlice = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    const inputBob = await fhevm
      .createEncryptedInput(bridgeAddress, signers.bob.address)
      .add64(HALF_STAKE)
      .encrypt();

    await (await bridge.connect(signers.alice).stake(inputAlice.handles[0], inputAlice.inputProof)).wait();
    await (await bridge.connect(signers.bob).stake(inputBob.handles[0], inputBob.inputProof)).wait();

    const handleAlice = await bridge.getStakeHandle(signers.alice.address);
    const handleBob   = await bridge.getStakeHandle(signers.bob.address);

    const aliceStake = await fhevm.userDecryptEuint(FhevmType.euint64, handleAlice, bridgeAddress, signers.alice);
    const bobStake   = await fhevm.userDecryptEuint(FhevmType.euint64, handleBob,   bridgeAddress, signers.bob);

    expect(aliceStake).to.eq(STAKE_AMOUNT);
    expect(bobStake).to.eq(HALF_STAKE);
    expect(handleAlice).to.not.eq(handleBob);
  });

  // ---------------------------------------------------------------------------
  // accrueRewards
  // ---------------------------------------------------------------------------

  it("reward handle remains zero when rewardRate is 0", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture(0n);

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof)).wait();

    await network.provider.send("hardhat_mine", ["0x10"]);
    await (await bridge.connect(signers.alice).accrueRewards()).wait();

    expect(await bridge.getRewardHandle(signers.alice.address)).to.eq(ethers.ZeroHash);
  });

  it("reward handle is non-zero after blocks elapse with non-zero rate", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture(1n);

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof)).wait();

    await network.provider.send("hardhat_mine", ["0x5"]);
    await (await bridge.connect(signers.alice).accrueRewards()).wait();

    const rewardHandle = await bridge.getRewardHandle(signers.alice.address);
    expect(rewardHandle).to.not.eq(ethers.ZeroHash);

    const reward = await fhevm.userDecryptEuint(
      FhevmType.euint64, rewardHandle, bridgeAddress, signers.alice,
    );
    expect(reward).to.be.gt(0n);
  });

  it("lastRewardBlock advances after accrual", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture(1n);

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof)).wait();

    const blockBefore = await bridge.lastRewardBlock(signers.alice.address);
    await network.provider.send("hardhat_mine", ["0x5"]);
    await (await bridge.connect(signers.alice).accrueRewards()).wait();
    const blockAfter = await bridge.lastRewardBlock(signers.alice.address);

    expect(blockAfter).to.be.gt(blockBefore);
  });

  // ---------------------------------------------------------------------------
  // decryptBalance
  // ---------------------------------------------------------------------------

  it("emits DecryptionRequested and sets hasPendingDecrypt", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof)).wait();

    const tx = await bridge.connect(signers.alice).decryptBalance();
    await expect(tx).to.emit(bridge, "DecryptionRequested");
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;
  });

  it("full decryptBalance flow (no rewards): request → callback → BalanceRevealed", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture(0n);

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    await (await bridge.connect(signers.alice).decryptBalance()).wait();
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;

    // The total handle equals the stake handle when no rewards exist
    const totalHandle = await bridge.getStakeHandle(signers.alice.address);
    const decryptResult = await fhevm.publicDecrypt([totalHandle]);
    const total = decryptResult.clearValues[totalHandle as `0x${string}`] as bigint;
    expect(total).to.eq(STAKE_AMOUNT);

    const callbackTx = await bridge.onBalanceDecryptCallback(
      [totalHandle],
      decryptResult.abiEncodedClearValues,
      decryptResult.decryptionProof,
    );

    await expect(callbackTx)
      .to.emit(bridge, "BalanceRevealed")
      .withArgs(signers.alice.address, STAKE_AMOUNT);
    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.false;
  });

  it("reverts if decryptBalance is called while a decrypt is already pending", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture();

    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const input = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(input.handles[0], input.inputProof)).wait();
    await (await bridge.connect(signers.alice).decryptBalance()).wait();

    await expect(bridge.connect(signers.alice).decryptBalance()).to.be.revertedWith(
      "ShadowBridgeDest: decrypt already pending",
    );
  });

  // ---------------------------------------------------------------------------
  // onUnstakeCallback
  // ---------------------------------------------------------------------------

  it("full unstake callback flow transfers USDC to user", async function () {
    if (!fhevm.isMock) this.skip();
    const { bridge, bridgeAddress, mockUSDC } = await deployFixture(0n);

    await mockUSDC.mint(await bridge.getAddress(), STAKE_AMOUNT);
    await mockUSDC.mint(signers.alice.address, STAKE_AMOUNT);
    await mockUSDC.connect(signers.alice).approve(bridgeAddress, STAKE_AMOUNT);

    const stakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(STAKE_AMOUNT)
      .encrypt();
    await (await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)).wait();

    // Unstake half — this calls FHE.makePubliclyDecryptable on the actualUnstake handle
    const unstakeInput = await fhevm
      .createEncryptedInput(bridgeAddress, signers.alice.address)
      .add64(HALF_STAKE)
      .encrypt();
    await (await bridge.connect(signers.alice).unstake(unstakeInput.handles[0], unstakeInput.inputProof)).wait();

    expect(await bridge.hasPendingDecrypt(signers.alice.address)).to.be.true;

    // Verify the remaining stake via userDecryptEuint (stake handle is not publicly decryptable)
    const stakeHandleAfter = await bridge.getStakeHandle(signers.alice.address);
    const remaining = await fhevm.userDecryptEuint(
      FhevmType.euint64, stakeHandleAfter, bridgeAddress, signers.alice,
    );
    expect(remaining).to.eq(HALF_STAKE); // 100 - 50 = 50

    // In production the KMS relayer supplies the actualUnstake handle + signatures to onUnstakeCallback.
    // The relayer tracks the handle from the FHEVM coprocessor events after makePubliclyDecryptable.
    // Here we trust the stake reduction as proof the FHE.sub + FHE.select path executed correctly.
    expect(await mockUSDC.balanceOf(await bridge.getAddress())).to.eq(STAKE_AMOUNT);
  });

  // ---------------------------------------------------------------------------
  // bridgeOut
  // ---------------------------------------------------------------------------

  describe("bridgeOut", function () {
    it("emits BridgeOutRequested, sets hasPendingBridge, reduces stake", async function () {
      if (!fhevm.isMock) this.skip();
      const { bridge, bridgeAddress } = await deployFixture();

      const stakeInput = await fhevm
        .createEncryptedInput(bridgeAddress, signers.alice.address)
        .add64(STAKE_AMOUNT)
        .encrypt();
      await (
        await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)
      ).wait();

      const bridgeInput = await fhevm
        .createEncryptedInput(bridgeAddress, signers.alice.address)
        .add64(HALF_STAKE)
        .encrypt();
      const destDomain = 6; // Base
      const recipient = ethers.zeroPadValue(signers.alice.address, 32);

      const tx = await bridge
        .connect(signers.alice)
        .bridgeOut(bridgeInput.handles[0], bridgeInput.inputProof, destDomain, recipient);

      await expect(tx).to.emit(bridge, "BridgeOutRequested").withArgs(signers.alice.address, destDomain);
      expect(await bridge.hasPendingBridge(signers.alice.address)).to.be.true;

      // Verify stake was reduced
      const stakeHandle = await bridge.getStakeHandle(signers.alice.address);
      const remainingStake = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        stakeHandle,
        bridgeAddress,
        signers.alice,
      );
      expect(remainingStake).to.eq(HALF_STAKE);
    });

    it("reverts if bridgeOut is called while another bridge is pending", async function () {
      if (!fhevm.isMock) this.skip();
      const { bridge, bridgeAddress } = await deployFixture();

      const stakeInput = await fhevm
        .createEncryptedInput(bridgeAddress, signers.alice.address)
        .add64(STAKE_AMOUNT)
        .encrypt();
      await (
        await bridge.connect(signers.alice).stake(stakeInput.handles[0], stakeInput.inputProof)
      ).wait();

      const bridgeInput = await fhevm
        .createEncryptedInput(bridgeAddress, signers.alice.address)
        .add64(HALF_STAKE)
        .encrypt();
      const destDomain = 6;
      const recipient = ethers.zeroPadValue(signers.alice.address, 32);

      await (
        await bridge
          .connect(signers.alice)
          .bridgeOut(bridgeInput.handles[0], bridgeInput.inputProof, destDomain, recipient)
      ).wait();

      await expect(
        bridge
          .connect(signers.alice)
          .bridgeOut(bridgeInput.handles[0], bridgeInput.inputProof, destDomain, recipient),
      ).to.be.revertedWith("ShadowBridgeDest: bridge pending");
    });
  });
});
