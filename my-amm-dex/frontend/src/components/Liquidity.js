
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  ROUTER_ADDRESS,
  RouterABI,
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS,
  FACTORY_ADDRESS, 
  FactoryABI,      
  TokenABI,        
  PairABI,         
} from "../utils/contracts";
import {
  Box,
  Button,
  Heading,
  Input,
  Text,
  Flex,
  Link,
  Spinner, 
} from "@chakra-ui/react";
import { toast } from "react-hot-toast";

const APP_TOKENS = {
  [TOKEN_A_ADDRESS]: { address: TOKEN_A_ADDRESS, decimals: 18, symbol: "TokenA" },
  [TOKEN_B_ADDRESS]: { address: TOKEN_B_ADDRESS, decimals: 18, symbol: "TokenB" },
  LP_TOKEN_DECIMALS: 18, 
};


function Liquidity() {
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [balanceA, setBalanceA] = useState("0");
  const [balanceB, setBalanceB] = useState("0");
  const [reserveA, setReserveA] = useState("0");
  const [reserveB, setReserveB] = useState("0");
  const [lpBalance, setLPBalance] = useState("0");
  const [txStatus, setTxStatus] = useState("");
  const [removeAmount, setRemoveAmount] = useState("");
  const [currentPairAddress, setCurrentPairAddress] = useState(ethers.ZeroAddress); 
  const [isLoading, setIsLoading] = useState(false); 


  const fetchBalances = useCallback(async (userAddress, _signerOrProvider) => {
    if (!userAddress || !_signerOrProvider) return;
    try {
      const tokenAContract = new ethers.Contract(TOKEN_A_ADDRESS, TokenABI, _signerOrProvider);
      const tokenBContract = new ethers.Contract(TOKEN_B_ADDRESS, TokenABI, _signerOrProvider);

      const decimalsA = APP_TOKENS[TOKEN_A_ADDRESS].decimals;
      const decimalsB = APP_TOKENS[TOKEN_B_ADDRESS].decimals;

      const [balA, balB] = await Promise.all([
        tokenAContract.balanceOf(userAddress),
        tokenBContract.balanceOf(userAddress),
      ]);
      setBalanceA(ethers.formatUnits(balA, decimalsA));
      setBalanceB(ethers.formatUnits(balB, decimalsB));
    } catch (err) {
      console.error("Error fetching balances:", err);
      setBalanceA("0");
      setBalanceB("0");
    }
  }, []); 

  const fetchPoolData = useCallback(async (_signerOrProvider, _account) => {
    if (!_signerOrProvider || !_account) return;
    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FactoryABI, _signerOrProvider);
      const pairAddress = await factoryContract.getPair(TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
      setCurrentPairAddress(pairAddress);

      if (pairAddress === ethers.ZeroAddress) {
        setReserveA("0");
        setReserveB("0");
        setLPBalance("0");
        console.warn("No liquidity pair found for TokenA and TokenB.");
        return;
      }

      const pairContract = new ethers.Contract(pairAddress, PairABI, _signerOrProvider);

      const [reserve0Raw, reserve1Raw] = await pairContract.getReserves();
      const token0AddressInPair = await pairContract.token0(); 

      const actualReserveARaw = (TOKEN_A_ADDRESS === token0AddressInPair) ? reserve0Raw : reserve1Raw;
      const actualReserveBRaw = (TOKEN_B_ADDRESS === token0AddressInPair) ? reserve0Raw : reserve1Raw;

      setReserveA(ethers.formatUnits(actualReserveARaw, APP_TOKENS[TOKEN_A_ADDRESS].decimals));
      setReserveB(ethers.formatUnits(actualReserveBRaw, APP_TOKENS[TOKEN_B_ADDRESS].decimals));

      const lp = await pairContract.balanceOf(_account);
      setLPBalance(ethers.formatUnits(lp, APP_TOKENS.LP_TOKEN_DECIMALS));

    } catch (err) {
      console.error("Error fetching pool data:", err);
      setReserveA("0");
      setReserveB("0");
      setLPBalance("0");
    }
  }, []); 

  useEffect(() => {
    if (provider && signer && account) {
      fetchBalances(account, signer);
      fetchPoolData(signer, account);
    }
  }, [account, signer, provider, fetchBalances, fetchPoolData]);


  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsLoading(true);
        const browserProvider = new ethers.BrowserProvider(window.ethereum); 
        setProvider(browserProvider);
        await window.ethereum.request({ method: "eth_requestAccounts" }); 
        const signerInstance = await browserProvider.getSigner();
        const address = await signerInstance.getAddress();
        setSigner(signerInstance);
        setAccount(address);
        toast.success("Wallet connected!");
        
        await fetchBalances(address, signerInstance);
        await fetchPoolData(signerInstance, address);

      } catch (err) {
        toast.error("Wallet connection failed.");
        console.error("Wallet connection error:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      toast.error("Please install MetaMask.");
    }
  };

  const handleAddLiquidity = async () => {
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    if (!amountA || isNaN(Number(amountA)) || Number(amountA) <= 0 || 
        !amountB || isNaN(Number(amountB)) || Number(amountB) <= 0) {
      toast.error("Enter valid amounts for both tokens.");
      return;
    }
    if (currentPairAddress === ethers.ZeroAddress && (Number(reserveA) !== 0 || Number(reserveB) !== 0)) {
        toast.error("Pair does not exist, and reserves are not zero. Something is off.");
        return;
    }
    if (Number(amountA) > Number(balanceA) || Number(amountB) > Number(balanceB)) {
      toast.error("Insufficient token balance(s).");
      return;
    }

    try {
      setIsLoading(true);
      setTxStatus("Approving TokenA...");

      const tokenAContract = new ethers.Contract(TOKEN_A_ADDRESS, TokenABI, signer);
      const tokenBContract = new ethers.Contract(TOKEN_B_ADDRESS, TokenABI, signer);
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);

      const amtAWei = ethers.parseUnits(amountA, APP_TOKENS[TOKEN_A_ADDRESS].decimals);
      const amtBWei = ethers.parseUnits(amountB, APP_TOKENS[TOKEN_B_ADDRESS].decimals);

      const approveTxA = await tokenAContract.approve(ROUTER_ADDRESS, amtAWei);
      await approveTxA.wait();
      toast.success("TokenA approved!");

      setTxStatus("Approving TokenB...");
      const approveTxB = await tokenBContract.approve(ROUTER_ADDRESS, amtBWei);
      await approveTxB.wait();
      toast.success("TokenB approved!");

      setTxStatus("Adding liquidity...");
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10; 

      const tx = await routerContract.addLiquidity(
        TOKEN_A_ADDRESS,
        TOKEN_B_ADDRESS,
        amtAWei,
        amtBWei,
        account, 
        deadline
      );
      await tx.wait();

      toast.success("Liquidity added successfully!");
      setTxStatus("");
      await fetchBalances(account, signer);
      await fetchPoolData(signer, account);
      setAmountA(""); 
      setAmountB(""); 
    } catch (err) {
      setTxStatus("Transaction failed.");
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      console.error("Add Liquidity error:", err);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!signer) {
      toast.error("Connect your wallet first!");
      return;
    }
    if (!removeAmount || isNaN(Number(removeAmount)) || Number(removeAmount) <= 0) {
      toast.error("Enter a valid amount of LP tokens to remove.");
      return;
    }
    if (Number(removeAmount) > Number(lpBalance)) {
        toast.error("Insufficient LP token balance.");
        return;
    }
    if (currentPairAddress === ethers.ZeroAddress) {
        toast.error("No liquidity pair exists to remove from.");
        return;
    }

    try {
      setIsLoading(true);
      setTxStatus("Approving LP tokens...");

      const pairContractAsLPToken = new ethers.Contract(currentPairAddress, TokenABI, signer); 
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);

      const amtLPWei = ethers.parseUnits(removeAmount, APP_TOKENS.LP_TOKEN_DECIMALS);
      
      const approveTx = await pairContractAsLPToken.approve(ROUTER_ADDRESS, amtLPWei);
      await approveTx.wait();
      toast.success("LP token approval successful!");

      setTxStatus("Removing liquidity...");
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10; 

      const tx = await routerContract.removeLiquidity(
        TOKEN_A_ADDRESS,
        TOKEN_B_ADDRESS,
        amtLPWei,
        deadline
      );
      await tx.wait();

      toast.success("Liquidity removed successfully!");
      setTxStatus("");
      await fetchBalances(account, signer);
      await fetchPoolData(signer, account);
      setRemoveAmount(""); 
    } catch (err) {
      setTxStatus("Transaction failed.");
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      console.error("Remove Liquidity error:", err);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box bg="white" p={8} rounded="2xl" boxShadow="lg" w="380px">
        <Flex mb={3} justify="space-between" align="center">
          <Link href="/" color="blue.400" fontWeight="bold">Swap</Link>
          <Link href="/liquidity" color="blue.400" fontWeight="bold">Liquidity</Link>
          <Link href="/limit-orders" color="blue.400" fontWeight="bold">Limit Orders</Link>
        </Flex>
        <Button w="100%" mb={5} colorScheme={account ? "green" : "blue"} onClick={connectWallet} isLoading={isLoading}>
          {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </Button>

        <Box mb={6} p={4} borderRadius="xl" boxShadow="md" bg="gray.100" display="flex" flexDirection="column" alignItems="center">
          <Text fontSize="lg" fontWeight="bold" color="gray.700" mb={1}>Pool Reserves</Text>
          <Flex gap={8} mb={2}>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.500" fontWeight="medium">TokenA</Text>
              <Text fontSize="xl" color="blue.500" fontWeight="bold">{reserveA}</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.500" fontWeight="medium">TokenB</Text>
              <Text fontSize="xl" color="green.500" fontWeight="bold">{reserveB}</Text>
            </Box>
          </Flex>
          <Flex gap={8}>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.400">Your TokenA</Text>
              <Text fontSize="md" color="blue.700" fontWeight="semibold">{balanceA}</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.400">Your TokenB</Text>
              <Text fontSize="md" color="green.700" fontWeight="semibold">{balanceB}</Text>
            </Box>
          </Flex>
          <Flex gap={8} mt={2}>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.400">Your LP</Text>
              <Text fontSize="md" color="purple.700" fontWeight="semibold">{lpBalance}</Text>
            </Box>
          </Flex>
        </Box>
        <Heading size="md" mb={4}>Add Liquidity</Heading>
        <Input mb={3} value={amountA} type="number" min="0" onChange={e => setAmountA(e.target.value)} placeholder="TokenA amount"/>
        <Input mb={3} value={amountB} type="number" min="0" onChange={e => setAmountB(e.target.value)} placeholder="TokenB amount"/>
        <Button w="100%" colorScheme="blue" onClick={handleAddLiquidity} isLoading={isLoading}>Add</Button>
        <Heading size="sm" mt={6} mb={2}>Remove Liquidity</Heading>
        <Input mb={2} value={removeAmount} type="number" min="0" onChange={e => setRemoveAmount(e.target.value)} placeholder="LP tokens to remove"/>
        <Button w="100%" colorScheme="red" onClick={handleRemoveLiquidity} isLoading={isLoading}>Remove</Button>
        {txStatus && (<Text mt={3} color="red.400" fontSize="sm">{txStatus}</Text>)}
        {isLoading && txStatus === "" && <Spinner mt={3} size="sm" color="blue.500" />} 
      </Box>
    </Flex>
  );
}

export default Liquidity;