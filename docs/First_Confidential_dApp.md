# Building Your First Confidential dApp with Zama FHEVM

## Introduction

This guide will walk you through building your first confidential decentralized application (dApp) using Zama's Fully
Homomorphic Encryption Virtual Machine (FHEVM). We'll create a simple confidential voting application where votes remain
encrypted throughout the entire process, ensuring voter privacy.

## Prerequisites

Before you begin, make sure you have:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **MetaMask** or another Web3 wallet
4. **Basic knowledge of**:
   - React/Next.js
   - Solidity smart contracts
   - Ethereum development

## Project Setup

### 1. Create a New Next.js Project

```bash
npx create-next-app@latest confidential-voting --typescript --tailwind --eslint
cd confidential-voting
```

### 2. Install Dependencies

```bash
npm install ethers hardhat @nomicfoundation/hardhat-toolbox
npm install fhevmjs
npm install @fhevm/contracts
```

### 3. Set Up Hardhat

```bash
npx hardhat init
```

Choose the following options:

- Create a JavaScript project
- Add to an existing project
- Install dependencies

### 4. Configure Hardhat

Update `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // forking -- uncomment below if you want to fork a network
      // forking: {
      //   url: "https://fhevm.zama.ai",
      // },
    },
    fhevm: {
      url: "https://fhevm.zama.ai",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
```

### 5. Set Up Environment Variables

Create a `.env.local` file:

```bash
# Zama FHEVM Configuration
ZAMA_API_KEY=your_api_key_here
ZAMA_KMS_URL=https://kms.zama.ai
ZAMA_NETWORK_URL=https://fhevm.zama.ai

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
NEXT_PUBLIC_NETWORK_ID=8008 # FHEVM network ID
```

## Building the Smart Contract

### 1. Create the Voting Contract

Create `contracts/ConfidentialVoting.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@fhevm/contracts/FHE.sol";

contract ConfidentialVoting {
  // State variables
  address public owner;
  string public proposal;
  uint256 public votingEndTime;
  bool public votingEnded;

  // Encrypted state
  euint64 private encryptedYesVotes;
  euint64 private encryptedNoVotes;
  mapping(address => bool) private hasVoted;

  // Events
  event Voted(address indexed voter, bytes32 handle);
  event VotingEnded(uint64 yesVotes, uint64 noVotes);

  // Modifiers
  modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
  }

  modifier votingOpen() {
    require(block.timestamp < votingEndTime, "Voting has ended");
    _;
  }

  constructor(string memory _proposal, uint256 _durationInMinutes) {
    owner = msg.sender;
    proposal = _proposal;
    votingEndTime = block.timestamp + (_durationInMinutes * 1 minutes);
    votingEnded = false;

    // Initialize encrypted vote counts
    encryptedYesVotes = FHE.asEuint64(0);
    encryptedNoVotes = FHE.asEuint64(0);
  }

  // Vote function
  function vote(euint64 encryptedVote, bytes calldata proof) public votingOpen {
    // Verify the proof
    require(FHE.verifyProof(encryptedVote, proof), "Invalid proof");

    // Check if already voted
    require(!hasVoted[msg.sender], "Already voted");

    // Mark as voted
    hasVoted[msg.sender] = true;

    // Determine if it's a yes (1) or no (2) vote
    ebool isYesVote = FHE.eq(encryptedVote, FHE.asEuint64(1));
    ebool isNoVote = FHE.eq(encryptedVote, FHE.asEuint64(2));

    // Ensure it's a valid vote
    ebool isValidVote = FHE.or(isYesVote, isNoVote);
    require(FHE.decrypt(isValidVote), "Invalid vote value");

    // Add to the appropriate count
    encryptedYesVotes = FHE.select(isYesVote, FHE.add(encryptedYesVotes, FHE.asEuint64(1)), encryptedYesVotes);

    encryptedNoVotes = FHE.select(isNoVote, FHE.add(encryptedNoVotes, FHE.asEuint64(1)), encryptedNoVotes);

    emit Voted(msg.sender, FHE.getHandle(encryptedVote));
  }

  // End voting and decrypt results
  function endVoting() public onlyOwner {
    require(block.timestamp >= votingEndTime, "Voting period not over");
    require(!votingEnded, "Voting already ended");

    votingEnded = true;

    // Request decryption of results
    FHE.makePubliclyDecryptable(encryptedYesVotes);
    FHE.makePubliclyDecryptable(encryptedNoVotes);
  }

  // Callback for decrypted results
  function onDecryptCallback(
    bytes32[] calldata handles,
    bytes calldata abiEncodedResult,
    bytes calldata decryptionProof
  ) external {
    // Verify the decryption proof
    FHE.checkSignatures(handles, abiEncodedResult, decryptionProof);

    // Decode the results
    uint64[] memory results = abi.decode(abiEncodedResult, (uint64[]));

    // Ensure we have both results
    require(handles.length == 2, "Invalid handles length");
    require(results.length == 2, "Invalid results length");

    // Emit the results
    emit VotingEnded(results[0], results[1]);
  }

  // View functions
  function getProposal() public view returns (string memory) {
    return proposal;
  }

  function getTimeRemaining() public view returns (uint256) {
    if (block.timestamp >= votingEndTime) {
      return 0;
    }
    return votingEndTime - block.timestamp;
  }

  function hasUserVoted(address voter) public view returns (bool) {
    return hasVoted[voter];
  }
}
```

### 2. Create a Deployment Script

Create `scripts/deploy.js`:

```javascript
async function main() {
  const ConfidentialVoting = await ethers.getContractFactory("ConfidentialVoting");

  // Deploy with a sample proposal and 30-minute voting duration
  const voting = await ConfidentialVoting.deploy(
    "Should we implement confidential voting in all dApps?",
    30, // 30 minutes
  );

  await voting.deployed();

  console.log("ConfidentialVoting deployed to:", voting.address);

  // Log the proposal and voting end time
  const proposal = await voting.getProposal();
  const timeRemaining = await voting.getTimeRemaining();

  console.log("Proposal:", proposal);
  console.log("Time remaining (seconds):", timeRemaining.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### 3. Deploy the Contract

```bash
npx hardhat run scripts/deploy.js --network fhevm
```

Save the deployed contract address for later use.

## Building the Frontend

### 1. Set Up FHEVM in the Frontend

Create `src/lib/fhevm.ts`:

```typescript
import { FhevmInstance } from "fhevmjs";

let fhevmInstance: FhevmInstance | null = null;

export async function getFhevmInstance() {
  if (fhevmInstance) {
    return fhevmInstance;
  }

  fhevmInstance = await FhevmInstance.create({
    kmsUrl: process.env.NEXT_PUBLIC_ZAMA_KMS_URL || "https://kms.zama.ai",
    networkUrl: process.env.NEXT_PUBLIC_ZAMA_NETWORK_URL || "https://fhevm.zama.ai",
    apiKey: process.env.NEXT_PUBLIC_ZAMA_API_KEY || "",
  });

  return fhevmInstance;
}

export async function encryptVote(vote: number): Promise<{ ciphertext: any; proof: any }> {
  const fhevm = await getFhevmInstance();

  // Encrypt the vote (1 for yes, 2 for no)
  const ciphertext = await fhevm.encrypt64(vote);

  // Generate proof
  const proof = await fhevm.generateProof({
    ciphertext: ciphertext,
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
  });

  return { ciphertext, proof };
}
```

### 2. Create the Voting Component

Create `src/components/Voting.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { encryptVote } from '@/lib/fhevm';

interface VotingProps {
  contractAddress: string;
}

export default function Voting({ contractAddress }: VotingProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [proposal, setProposal] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [isVoting, setIsVoting] = useState<boolean>(false);
  const [votingEnded, setVotingEnded] = useState<boolean>(false);
  const [yesVotes, setYesVotes] = useState<number>(0);
  const [noVotes, setNoVotes] = useState<number>(0);
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  // ABI for the voting contract
  const contractABI = [
    "function getProposal() view returns (string)",
    "function getTimeRemaining() view returns (uint256)",
    "function hasUserVoted(address) view returns (bool)",
    "function vote(euint64, bytes)",
    "function endVoting()",
    "event Voted(address, bytes32)",
    "event VotingEnded(uint64, uint64)",
  ];

  useEffect(() => {
    connectWallet();
    loadContract();
  }, [contractAddress]);

  useEffect(() => {
    if (contract) {
      loadProposal();
      loadTimeRemaining();
      checkIfVoted();

      // Set up event listeners
      contract.on('VotingEnded', (yes: number, no: number) => {
        setYesVotes(yes);
        setNoVotes(no);
        setVotingEnded(true);
      });

      // Update time remaining every second
      const interval = setInterval(() => {
        loadTimeRemaining();
      }, 1000);

      return () => {
        clearInterval(interval);
        contract.removeAllListeners();
      };
    }
  }, [contract]);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    }
  };

  const loadContract = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const votingContract = new ethers.Contract(
        contractAddress,
        contractABI,
        signer
      );

      setContract(votingContract);
    }
  };

  const loadProposal = async () => {
    if (contract) {
      const proposalText = await contract.getProposal();
      setProposal(proposalText);
    }
  };

  const loadTimeRemaining = async () => {
    if (contract) {
      const time = await contract.getTimeRemaining();
      setTimeRemaining(Number(time));

      if (time === 0) {
        setVotingEnded(true);
      }
    }
  };

  const checkIfVoted = async () => {
    if (contract && account) {
      const voted = await contract.hasUserVoted(account);
      setHasVoted(voted);
    }
  };

  const handleVote = async (voteType: 'yes' | 'no') => {
    if (!contract || !account || hasVoted || votingEnded) return;

    setIsVoting(true);

    try {
      // Encrypt the vote (1 for yes, 2 for no)
      const { ciphertext, proof } = await encryptVote(voteType === 'yes' ? 1 : 2);

      // Submit the vote
      const tx = await contract.vote(ciphertext, proof);
      await tx.wait();

      setHasVoted(true);
    } catch (error) {
      console.error('Error voting:', error);
      alert('Error submitting vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleEndVoting = async () => {
    if (!contract || votingEnded) return;

    try {
      const tx = await contract.endVoting();
      await tx.wait();
    } catch (error) {
      console.error('Error ending voting:', error);
      alert('Error ending voting. Please try again.');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-6">Confidential Voting</h1>

      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Proposal</h2>
        <p className="text-gray-700">{proposal}</p>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="font-medium">Time Remaining:</span>
          <span className={`text-lg font-bold ${timeRemaining < 60 ? 'text-red-600' : 'text-blue-600'}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {!votingEnded ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Cast Your Vote</h2>

          {account ? (
            hasVoted ? (
              <div className="p-4 bg-green-100 text-green-800 rounded-lg">
                <p>Thank you for voting! Your vote has been recorded confidentially.</p>
              </div>
            ) : (
              <div className="flex space-x-4">
                <button
                  onClick={() => handleVote('yes')}
                  disabled={isVoting}
                  className="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVoting ? 'Voting...' : 'Vote Yes'}
                </button>

                <button
                  onClick={() => handleVote('no')}
                  disabled={isVoting}
                  className="flex-1 py-3 px-6 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVoting ? 'Voting...' : 'Vote No'}
                </button>
              </div>
            )
          ) : (
            <button
              onClick={connectWallet}
              className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Connect Wallet to Vote
            </button>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Voting Results</h2>

          <div className="space-y-4">
            <div className="p-4 bg-green-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Yes Votes:</span>
                <span className="text-2xl font-bold text-green-700">{yesVotes}</span>
              </div>
            </div>

            <div className="p-4 bg-red-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">No Votes:</span>
                <span className="text-2xl font-bold text-red-700">{noVotes}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {account && !votingEnded && timeRemaining > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}
          </p>
        </div>
      )}

      {account && !votingEnded && timeRemaining > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={handleEndVoting}
            className="py-2 px-4 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700"
          >
            End Voting Early
          </button>
        </div>
      )}
    </div>
  );
}
```

### 3. Update the Main Page

Replace `src/app/page.tsx`:

```typescript
'use client';

import Voting from '@/components/Voting';

export default function Home() {
  // Replace with your deployed contract address
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

  if (!contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center mb-4">Configuration Required</h1>
          <p className="text-gray-600 text-center">
            Please set the NEXT_PUBLIC_CONTRACT_ADDRESS environment variable with your deployed contract address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <Voting contractAddress={contractAddress} />
    </div>
  );
}
```

### 4. Add Environment Variables to Next.js

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    NEXT_PUBLIC_ZAMA_API_KEY: process.env.NEXT_PUBLIC_ZAMA_API_KEY,
    NEXT_PUBLIC_ZAMA_KMS_URL: process.env.NEXT_PUBLIC_ZAMA_KMS_URL,
    NEXT_PUBLIC_ZAMA_NETWORK_URL: process.env.NEXT_PUBLIC_ZAMA_NETWORK_URL,
  },
};

module.exports = nextConfig;
```

## Testing the Application

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Test the Voting Flow

1. **Connect Your Wallet**
   - Click "Connect Wallet to Vote"
   - Approve the connection in MetaMask

2. **Cast a Vote**
   - Click either "Vote Yes" or "Vote No"
   - Confirm the transaction in MetaMask
   - Your vote will be encrypted and submitted

3. **Verify Confidentiality**
   - Notice that your vote choice is not revealed on the blockchain
   - The encrypted vote is stored in the contract

4. **End Voting**
   - Wait for the timer to expire or click "End Voting Early"
   - The results will be decrypted and displayed

### 3. Check the Blockchain

You can verify that the votes are encrypted by:

1. Going to the FHEVM block explorer
2. Looking up your transaction
3. Confirming that the vote parameter is encrypted

## Advanced Features

### 1. Multiple Proposals

Extend the contract to support multiple proposals:

```solidity
// In ConfidentialVoting.sol
struct Proposal {
    string description;
    euint64 encryptedVotes;
}

Proposal[] public proposals;

function vote(uint256 proposalIndex, euint64 encryptedVote, bytes calldata proof) public {
    // Validate proposal index
    require(proposalIndex < proposals.length, "Invalid proposal index");

    // Rest of the voting logic...

    // Add to the proposal's vote count
    proposals[proposalIndex].encryptedVotes = FHE.add(
        proposals[proposalIndex].encryptedVotes,
        FHE.asEuint64(1)
    );
}
```

### 2. Delegated Voting

Add support for delegated voting:

```solidity
mapping(address => address) public delegates;

function delegate(address to) public {
    require(!hasVoted[msg.sender], "Already voted");
    require(to != msg.sender, "Cannot delegate to self");

    delegates[msg.sender] = to;
}
```

### 3. Vote Weighting

Implement weighted voting based on token holdings:

```solidity
mapping(address => euint64) public votingPower;

function getVotingPower(address voter) internal view returns (euint64) {
    // In a real implementation, this would check token balance
    return FHE.asEuint64(1); // Default to 1 vote per person
}

function vote(euint64 encryptedVote, bytes calldata proof) public {
    // Get voting power
    euint64 power = getVotingPower(msg.sender);

    // Multiply vote by voting power
    euint64 weightedVote = FHE.mul(encryptedVote, power);

    // Rest of the voting logic...
}
```

## Deployment

### 1. Build the Application

```bash
npm run build
```

### 2. Deploy to Vercel

1. Push your code to a GitHub repository
2. Connect the repository to Vercel
3. Add environment variables in Vercel dashboard:
   - NEXT_PUBLIC_CONTRACT_ADDRESS
   - NEXT_PUBLIC_ZAMA_API_KEY
   - NEXT_PUBLIC_ZAMA_KMS_URL
   - NEXT_PUBLIC_ZAMA_NETWORK_URL

### 3. Deploy to IPFS

For a fully decentralized deployment:

```bash
npm install -g ipfs-deploy
ipfs-deploy dist
```

## Troubleshooting

### Common Issues

1. **"Invalid proof" Error**
   - Make sure you're using the correct contract address
   - Check that your API key is valid
   - Ensure you're on the correct network (FHEVM)

2. **"Already voted" Error**
   - Each address can only vote once
   - Check if you've already voted with this address

3. **"Voting has ended" Error**
   - The voting period has expired
   - Only the contract owner can end voting early

4. **Connection Issues**
   - Make sure MetaMask is connected to the FHEVM network
   - Check that your API key is correctly configured

### Debugging Tips

1. **Check the Console**
   - Browser console logs can provide detailed error information
   - Network tab shows API requests and responses

2. **Verify Contract State**
   - Use the contract's view functions to check state
   - Verify that the voting period is still active

3. **Test with Different Accounts**
   - Try voting with different accounts
   - Ensure the voting logic works correctly

## Conclusion

Congratulations! You've built your first confidential dApp using Zama's FHEVM. This application demonstrates the power
of fully homomorphic encryption in maintaining privacy while enabling transparent voting.

Key takeaways:

- Votes remain encrypted throughout the entire process
- Only the final results are revealed, not individual votes
- The blockchain verifies that votes are valid without revealing their content
- FHE enables new possibilities for privacy-preserving applications

From here, you can explore more complex applications like:

- Confidential financial transactions
- Private auctions
- Secure multi-party computations
- Privacy-preserving DeFi protocols

The possibilities are endless with FHEVM!
