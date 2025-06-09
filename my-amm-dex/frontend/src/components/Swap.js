import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  ROUTER_ADDRESS,
  RouterABI,
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS,
  PAIR_ADDRESS,
  TokenABI,
  PairABI,
} from "../utils/contracts";
import {
  Box,
  Button,
  Heading,
  Input,
  Select,
  Text,
  Flex,
  Link,
} from "@chakra-ui/react";
import { toast } from "react-hot-toast";

function Swap() {
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenIn, setTokenIn] = useState(TOKEN_A_ADDRESS);
  const [tokenOut, setTokenOut] = useState(TOKEN_B_ADDRESS);
  const [balanceA, setBalanceA] = useState("0");
  const [balanceB, setBalanceB] = useState("0");
  const [reserveA, setReserveA] = useState("0");
  const [reserveB, setReserveB] = useState("0");
  const [estimatedOut, setEstimatedOut] = useState("");
  const [txStatus, setTxStatus] = useState("");

  const getEstimatedOutput = (inputAmount, inputReserve, outputReserve) => {
    if (!inputAmount || !inputReserve || !outputReserve || inputReserve === 0) return 0;
    const amtInWithFee = inputAmount * 997;
    const numerator = amtInWithFee * outputReserve;
    const denominator = (inputReserve * 1000) + amtInWithFee;
    return numerator / denominator;
  };

  const fetchBalances = async (userAddress, _signer, _provider) => {
    try {
      const signerOrProvider = _signer || _provider || signer || provider;
      const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, TokenABI, signerOrProvider);
      const tokenB = new ethers.Contract(TOKEN_B_ADDRESS, TokenABI, signerOrProvider);

      const [balA, balB] = await Promise.all([
        tokenA.balanceOf(userAddress),
        tokenB.balanceOf(userAddress),
      ]);
      setBalanceA(ethers.formatUnits(balA, 18));
      setBalanceB(ethers.formatUnits(balB, 18));
    } catch (err) {
      setBalanceA("0");
      setBalanceB("0");
    }
  };

  const fetchReserves = async (_signer, _provider) => {
    try {
      const signerOrProvider = _signer || _provider || signer || provider;
      const pair = new ethers.Contract(PAIR_ADDRESS, PairABI, signerOrProvider);
      const [reserve0, reserve1] = await pair.getReserves();
      // NOTE: This assumes TokenA is token0 and TokenB is token1. 
      // For a more robust app, you would check the token0() address on the pair contract.
      setReserveA(ethers.formatUnits(reserve0, 18));
      setReserveB(ethers.formatUnits(reserve1, 18));
    } catch (err) {
      setReserveA("0");
      setReserveB("0");
    }
  };

  const updateEstimatedOut = () => {
    let input = Number(amount);
    let rIn = tokenIn === TOKEN_A_ADDRESS ? Number(reserveA) : Number(reserveB);
    let rOut = tokenIn === TOKEN_A_ADDRESS ? Number(reserveB) : Number(reserveA);
    if (input > 0 && rIn > 0 && rOut > 0) {
      const estimated = getEstimatedOutput(input, rIn, rOut);
      setEstimatedOut(estimated.toFixed(6));
    } else {
      setEstimatedOut("");
    }
  };

  useEffect(() => { updateEstimatedOut(); }, [amount, tokenIn, tokenOut, reserveA, reserveB]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setSigner(signer);
        setAccount(address);
        toast.success("Wallet connected");
        await fetchBalances(address, signer, provider);
        await fetchReserves(signer, provider);
      } catch (err) {
        toast.error("Wallet connection failed.");
      }
    } else {
      toast.error("Please install MetaMask.");
    }
  };

  const handleSwap = async () => {
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (tokenIn === tokenOut) {
      toast.error("Select different tokens to swap.");
      return;
    }
    try {
      setTxStatus("Approving...");
      const tokenInContract = new ethers.Contract(tokenIn, TokenABI, signer);
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);

      const amountIn = ethers.parseUnits(amount, 18);

      const approveTx = await tokenInContract.approve(ROUTER_ADDRESS, amountIn);
      await approveTx.wait();

      setTxStatus("Swapping...");
      
      const path = [tokenIn, tokenOut];
      const to = account;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      
      const slippage = 1; 
      const amountOutMinWei = ethers.parseUnits(
          (Number(estimatedOut) * (100 - slippage) / 100).toFixed(18), 18
      );
      
      const swapTx = await routerContract.swapExactTokensForTokens(
        amountIn,
        amountOutMinWei,
        path,
        to,
        deadline
      );
      
      await swapTx.wait();

      toast.success("Swap complete!");
      await fetchBalances(account, signer, provider);
      await fetchReserves(signer, provider);
    } catch (err) {
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      toast.error(errorMessage);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box bg="white" p={8} rounded="2xl" boxShadow="lg" w="380px">
        <Flex mb={3} justify="space-between" align="center">
          <Link href="/" color="blue.400" fontWeight="bold">Swap</Link>
          <Link href="/liquidity" color="blue.400" fontWeight="bold">Liquidity</Link>
        </Flex>
        <Button w="100%" mb={5} colorScheme={account ? "green" : "blue"} onClick={connectWallet}>
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
        </Box>
        <Heading size="md" mb={4}>Swap</Heading>
        <Flex gap={2} mb={4}>
          <Select value={tokenIn} onChange={e => setTokenIn(e.target.value)}>
            <option value={TOKEN_A_ADDRESS}>TokenA</option>
            <option value={TOKEN_B_ADDRESS}>TokenB</option>
          </Select>
          <Select value={tokenOut} onChange={e => setTokenOut(e.target.value)}>
            <option value={TOKEN_B_ADDRESS}>TokenB</option>
            <option value={TOKEN_A_ADDRESS}>TokenA</option>
          </Select>
        </Flex>
        <Input mb={3} value={amount} type="number" min="0" onChange={e => setAmount(e.target.value)} placeholder="Amount"/>
        {estimatedOut && (
          <Text mb={3} fontSize="sm" color="gray.700">Estimated Received: {estimatedOut}</Text>
        )}
        <Button w="100%" colorScheme="blue" onClick={handleSwap}>Swap</Button>
        {txStatus && (<Text mt={3} color="red.400" fontSize="sm">{txStatus}</Text>)}
      </Box>
    </Flex>
  );
}

export default Swap;