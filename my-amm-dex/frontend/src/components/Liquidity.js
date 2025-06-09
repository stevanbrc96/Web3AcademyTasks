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
  Text,
  Flex,
  Link,
} from "@chakra-ui/react";
import { toast } from "react-hot-toast";

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

  const fetchPoolData = async (_signer, _provider, _account) => {
    try {
      const signerOrProvider = _signer || _provider || signer || provider;
      const pair = new ethers.Contract(PAIR_ADDRESS, PairABI, signerOrProvider);

      const [reserve0, reserve1] = await pair.getReserves();
      setReserveA(ethers.formatUnits(reserve0, 18));
      setReserveB(ethers.formatUnits(reserve1, 18));

      if (_account || account) {
        const lp = await pair.balanceOf(_account || account);
        setLPBalance(ethers.formatUnits(lp, 18));
      } else {
        setLPBalance("0");
      }
    } catch (err) {
      setReserveA("0");
      setReserveB("0");
      setLPBalance("0");
    }
  };

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
        await fetchPoolData(signer, provider, address);
      } catch (err) {
        toast.error("Wallet connection failed.");
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
    if (!amountA || isNaN(Number(amountA)) || Number(amountA) <= 0 || !amountB || isNaN(Number(amountB)) || Number(amountB) <= 0) {
      toast.error("Enter valid amounts for both tokens.");
      return;
    }
    try {
      setTxStatus("Approving TokenA...");
      const tokenA = new ethers.Contract(TOKEN_A_ADDRESS, TokenABI, signer);
      const amtA = ethers.parseUnits(amountA, 18);
      const approveTxA = await tokenA.approve(ROUTER_ADDRESS, amtA);
      await approveTxA.wait();

      setTxStatus("Approving TokenB...");
      const tokenB = new ethers.Contract(TOKEN_B_ADDRESS, TokenABI, signer);
      const amtB = ethers.parseUnits(amountB, 18);
      const approveTxB = await tokenB.approve(ROUTER_ADDRESS, amtB);
      await approveTxB.wait();

      setTxStatus("Adding liquidity...");
      const router = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      const tx = await router.addLiquidity(
        TOKEN_A_ADDRESS,
        TOKEN_B_ADDRESS,
        amtA,
        amtB,
        deadline
      );
      await tx.wait();

      toast.success("Liquidity added!");
      await fetchBalances(account, signer, provider);
      await fetchPoolData(signer, provider, account);
    } catch (err) {
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      toast.error(errorMessage);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!signer) {
      toast.error("Connect your wallet first!");
      return;
    }
    if (!removeAmount || isNaN(Number(removeAmount)) || Number(removeAmount) <= 0) {
      toast.error("Enter a valid amount of LP tokens.");
      return;
    }
    try {
      setTxStatus("Approving LP tokens...");
      const pair = new ethers.Contract(PAIR_ADDRESS, PairABI, signer);
      const amt = ethers.parseUnits(removeAmount, 18);
      const approveTx = await pair.approve(ROUTER_ADDRESS, amt);
      await approveTx.wait();

      setTxStatus("Removing liquidity...");
      const router = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
      const tx = await router.removeLiquidity(
        TOKEN_A_ADDRESS,
        TOKEN_B_ADDRESS,
        amt,
        deadline
      );
      await tx.wait();

      toast.success("Liquidity removed!");
      await fetchBalances(account, signer, provider);
      await fetchPoolData(signer, provider, account);
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
        <Button w="100%" colorScheme="blue" onClick={handleAddLiquidity}>Add</Button>
        <Heading size="sm" mt={6} mb={2}>Remove Liquidity</Heading>
        <Input mb={2} value={removeAmount} type="number" min="0" onChange={e => setRemoveAmount(e.target.value)} placeholder="LP tokens to remove"/>
        <Button w="100%" colorScheme="red" onClick={handleRemoveLiquidity}>Remove</Button>
        {txStatus && (<Text mt={3} color="red.400" fontSize="sm">{txStatus}</Text>)}
      </Box>
    </Flex>
  );
}

export default Liquidity;