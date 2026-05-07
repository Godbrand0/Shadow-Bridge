import { ethers } from "hardhat";

/**
 * mint-test-tokens.ts
 *
 * Mints free mock USDC from Zama's public testnet faucet contract.
 * Up to 1,000,000 USDC per call; we mint 1,000 USDC.
 *
 * Zama testnet token addresses (Sepolia):
 *   Underlying mock USDC: 0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
 *
 * Usage:
 *   npx hardhat run scripts/mint-test-tokens.ts --network sepolia
 */

const MOCK_USDC    = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const MINT_AMOUNT  = ethers.parseUnits("1000", 6); // 1,000 USDC (6 decimals)

const MINT_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Minting to:", deployer.address);
  console.log("Token:     ", MOCK_USDC);
  console.log("Amount:     1,000 USDC\n");

  const usdc = await ethers.getContractAt(MINT_ABI, MOCK_USDC, deployer);

  const symbol   = await usdc.symbol();
  const decimals = await usdc.decimals();
  const before   = await usdc.balanceOf(deployer.address);

  console.log(`Balance before: ${ethers.formatUnits(before, decimals)} ${symbol}`);

  const tx = await usdc.mint(deployer.address, MINT_AMOUNT);
  const receipt = await tx.wait();
  console.log("✓ Minted — tx:", receipt.hash);

  const after = await usdc.balanceOf(deployer.address);
  console.log(`Balance after:  ${ethers.formatUnits(after, decimals)} ${symbol}`);
  console.log(`\nNet minted:     +${ethers.formatUnits(after - before, decimals)} ${symbol}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
