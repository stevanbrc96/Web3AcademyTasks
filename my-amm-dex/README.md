# Decentralized Exchange (DEX)

This project features a complete Decentralized Exchange (DEX) based on the Automated Market Maker (AMM) model, implemented on the Ethereum Virtual Machine (EVM) using Solidity smart contracts and a React frontend application. The DEX supports token swapping, liquidity provision/removal, and limit order functionality.

---

## 🌟 Key Features

- **AMM Smart Contracts**
  - **AMMFactory**: Contract responsible for creating and managing liquidity pairs.
  - **AMMPair**: Each liquidity pair is an ERC-20 token representing LP (Liquidity Provider) shares, and it contains the logic for minting/burning LP tokens, adding/removing liquidity, and executing swaps.
  - **AMMRouter**: The main interaction point for users, facilitating complex operations such as adding/removing liquidity and executing swaps.
- **Fee-on-Transfer Tokens Support**
  - The AMMRouter is designed to correctly handle tokens that charge a fee on each transfer.
- **Limit Orders**
  - **OrderBook Contract**: An on-chain smart contract where users can create and cancel limit orders.
  - **Frontend Interface**: Allows users to create limit orders with specific price conditions.
- **Frontend Application (React)**
  - Intuitive user interface built with React.js and Ethers.js.
  - **Swap Page**: Enables users to swap one token for another, displaying estimated prices.
  - **Liquidity Page**: Allows users to add or remove liquidity from a pool, showing pool reserves and LP token balances.
  - **Price Chart**: Displays historical token prices using on-chain event data.
  - **Limit Orders Page**: Interface for creating and canceling limit orders.
- **Robust Unit Tests**
  - A comprehensive suite of unit tests written in the Hardhat environment, covering all key smart contract functionalities, including adding/removing liquidity, swaps (with and without fee-on-transfer tokens), and limit order functionality.

---

## 🚀 Technologies Used

- **Solidity** (v0.8.20)
- **Hardhat** (Development Environment, Testing, Deployment)
- **OpenZeppelin Contracts** (ERC-20, Ownable)
- **React.js** (Frontend Framework)
- **Ethers.js** (Blockchain Interaction)
- **Chakra UI** (UI Components)
- **Chart.js / React-Chartjs-2** (For Price Charts)
- **Chai** (Assertion Library for Tests)

---

## 🛠️ Setup & Installation

Follow these steps to get the project up and running locally.

### Prerequisites

- Node.js (v18.x or newer)
- npm or yarn
- MetaMask browser extension

---

### Backend (Smart Contracts)

1. **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/your-repo.git
    cd your-repo
    ```

2. **Install Hardhat dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3. **Compile smart contracts:**

    ```bash
    npx hardhat compile
    ```

4. **Start a local Hardhat blockchain node:**  
   Open your first terminal and run:

    ```bash
    npx hardhat node
    ```
   > This terminal must remain open while you use the application.

5. **Deploy contracts:**  
   Open your second terminal, navigate to the project root, and run the deploy script:

    ```bash
    npx hardhat run scripts/deploy-full-system.js --network localhost
    ```
    > If deploying to Goerli, change `--network localhost` to `--network goerli` and ensure you have Goerli ETH and your RPC URL configured in `hardhat.config.js`.

    > **NOTE DOWN ALL CONTRACT ADDRESSES** (FACTORY, ROUTER, TOKEN A, TOKEN B, ORDERBOOK) printed in the terminal.

---

### Frontend (React App)

1. **Navigate to the frontend folder:**

    ```bash
    cd frontend
    ```

2. **Install frontend dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3. **Update contract addresses and ABIs:**

    - Open the `frontend/src/utils/contracts.js` file.
    - Replace all `YOUR_ACTUAL_DEPLOYED_..._ADDRESS` placeholders with the addresses you noted down after deployment.

    **Regarding ABI JSON files:**
    - By default, `contracts.js` imports ABI JSON files from your Hardhat artifacts directory using relative paths (e.g., `../../artifacts/contracts/AMMRouter.sol/AMMRouter.json`). This is the standard practice.
    - If you encounter "Module not found" errors for these JSON files, copy the artifact files (e.g., `AMMRouter.json`, `AMMPair.json`, `TokenA.json`, `AMMFactory.json`, `OrderBook.json`) directly into the `frontend/src/utils/` folder.
    - If you copied them, update your `contracts.js` imports to:

      ```js
      import RouterJSON from "./AMMRouter.json";
      import PairJSON from "./AMMPair.json";
      // ...and so on for other JSON files
      ```

    - Ensure the token decimals are correctly set (for TokenA and TokenB, they are 18).

4. **Start the frontend application:**

    ```bash
    npm start
    ```

    This will launch the application at [http://localhost:3000](http://localhost:3000) (or similar address).

---

## 🚀 Usage

1. **Connect MetaMask:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.
   - Ensure your MetaMask is connected to your local Hardhat network (or Goerli testnet).
   - Click "Connect Wallet".

2. **Import Test Tokens into MetaMask:**
   - In MetaMask, click "Import tokens" → "Custom token".
   - Enter the `TOKEN_A_ADDRESS` and `TOKEN_B_ADDRESS` (from `contracts.js`) to view their balances.
   - Your connected wallet (the deployer) should have the initial supply of these tokens.

3. **Add Liquidity:**
   - Go to the "Liquidity" page.
   - Enter the desired amounts for Token A and Token B.
   - Click "Add" to provide liquidity and receive LP tokens.  
     *(This is crucial before performing any swaps!)*

4. **Execute Swap:**
   - Navigate to the "Swap" page.
   - Select the tokens for swapping and enter the amount.
   - Click "Swap".
   - Observe the price chart!

5. **Place a Limit Order:**
   - Go to the "Limit Orders" page.
   - Enter the tokens, the amount you're selling ("Amount In"), and the minimum amount you wish to receive ("Minimum Receive").
   - Click "Create Order".
   - *(Note: Orders will be displayed, but their status won't update in real-time without additional event tracking logic or a keeper bot.)*

---

## 🧪 Tests

Unit tests are essential for verifying the logic of your smart contracts.

1. Ensure your Hardhat node is running in the first terminal (`npx hardhat node`).
2. In the second terminal, navigate to the project root.
3. Run all tests:

    ```bash
    npx hardhat test
    ```

    *(Alternatively, you can run individual test files, e.g., `npx hardhat test test/amm-core.js`).*

---

## 🔮 Optional Future Enhancements

- **Full Limit Order Status Display:** Implement tracking of `OrderFilled` and `OrderCancelled` events on the frontend for real-time order status updates.
- **Keeper Bot:** Develop an off-chain script that automatically executes limit orders when price conditions are met.
- **Enhanced Charts:** Add more charting options, data aggregation, etc.
- **Gas Optimizations:** Further optimize gas usage for smart contracts.
- **UI/UX Improvements:** General improvement to the user experience and design.

---

## 📄 License

This project is licensed under the MIT License.

