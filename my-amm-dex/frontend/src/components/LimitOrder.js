
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS,
  TokenABI,        
  OrderBookABI,    
  ORDER_BOOK_ADDRESS, 
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
  Spinner,
  Stack, 
} from "@chakra-ui/react";
import { toast } from "react-hot-toast";

const APP_TOKENS = {
  [TOKEN_A_ADDRESS]: { address: TOKEN_A_ADDRESS, decimals: 18, symbol: "TokenA" },
  [TOKEN_B_ADDRESS]: { address: TOKEN_B_ADDRESS, decimals: 18, symbol: "TokenB" },
};

const OrderStatus = {
  0: "Open",
  1: "Filled",
  2: "Cancelled",
};

function LimitOrder() { 
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [balanceA, setBalanceA] = useState("0");
  const [balanceB, setBalanceB] = useState("0");
  const [tokenInAddress, setTokenInAddress] = useState(TOKEN_A_ADDRESS); 
  const [tokenOutAddress, setTokenOutAddress] = useState(TOKEN_B_ADDRESS); 
  const [amountIn, setAmountIn] = useState(""); 
  const [amountOutMin, setAmountOutMin] = useState(""); 
  const [txStatus, setTxStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userOrders, setUserOrders] = useState([]); 

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

  const fetchUserOrders = useCallback(async (_account, _provider) => {
    if (!_account || !_provider) return;
    try {
      const orderBookContract = new ethers.Contract(ORDER_BOOK_ADDRESS, OrderBookABI, _provider);

      const filter = orderBookContract.filters.OrderCreated(null, _account);

      const logs = await orderBookContract.queryFilter(filter, 0, "latest"); 

      const parsedOrders = logs.map(log => {
        const args = log.args; 
        return {
          id: args.id,
          owner: args.owner,
          tokenIn: args.tokenIn,
          tokenOut: args.tokenOut,
          amountIn: args.amountIn,
          amountOutMin: args.amountOutMin,
          status: OrderStatus[0], 
        };
      });

      setUserOrders(parsedOrders); 
      console.log("Fetched user orders:", parsedOrders);

    } catch (err) {
      console.error("Error fetching user orders:", err);
      setUserOrders([]);
    }
  }, []);


  useEffect(() => {
    if (provider && signer && account) {
      fetchBalances(account, signer);
      fetchUserOrders(account, provider); 
    }
  }, [account, signer, provider, fetchBalances, fetchUserOrders]);


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
        await fetchUserOrders(address, browserProvider);

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

  const handleCreateOrder = async () => {
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0 ||
        !amountOutMin || isNaN(Number(amountOutMin)) || Number(amountOutMin) <= 0) {
      toast.error("Enter valid amounts for both tokens.");
      return;
    }
    if (tokenInAddress === tokenOutAddress) {
      toast.error("Select different tokens for input and output.");
      return;
    }

    const tokenInInfo = APP_TOKENS[tokenInAddress];
    const tokenOutInfo = APP_TOKENS[tokenOutAddress];

    const currentBalanceTokenIn = (tokenInAddress === TOKEN_A_ADDRESS) ? Number(balanceA) : Number(balanceB);
    if (Number(amountIn) > currentBalanceTokenIn) {
      toast.error(`Insufficient ${tokenInInfo.symbol} balance.`);
      return;
    }

    try {
      setIsLoading(true);
      setTxStatus("Approving Token In...");

      const tokenInContract = new ethers.Contract(tokenInAddress, TokenABI, signer);
      const orderBookContract = new ethers.Contract(ORDER_BOOK_ADDRESS, OrderBookABI, signer);

      const amountInWei = ethers.parseUnits(amountIn, tokenInInfo.decimals);
      
      const approveTx = await tokenInContract.approve(ORDER_BOOK_ADDRESS, amountInWei);
      await approveTx.wait();
      toast.success("Token In approved for OrderBook!");

      setTxStatus("Creating Order...");

      const amountOutMinWei = ethers.parseUnits(amountOutMin, tokenOutInfo.decimals);

      const createOrderTx = await orderBookContract.createOrder(
        tokenInAddress,
        tokenOutAddress,
        amountInWei,
        amountOutMinWei
      );
      await createOrderTx.wait();

      toast.success("Limit Order created successfully!");
      setTxStatus("");
      setAmountIn(""); 
      setAmountOutMin("");
      await fetchBalances(account, signer); 
      await fetchUserOrders(account, provider); 
    } catch (err) {
      setTxStatus("Order creation failed.");
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      console.error("Create Order error:", err);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!signer) {
        toast.error("Connect wallet to cancel order.");
        return;
    }
    try {
        setIsLoading(true);
        setTxStatus(`Cancelling Order ${orderId}...`);
        const orderBookContract = new ethers.Contract(ORDER_BOOK_ADDRESS, OrderBookABI, signer);
        const cancelTx = await orderBookContract.cancelOrder(orderId);
        await cancelTx.wait();
        toast.success(`Order ${orderId} cancelled!`);
        setTxStatus("");
        await fetchUserOrders(account, provider); 
        await fetchBalances(account, signer); 
    } catch (err) {
        setTxStatus("Order cancellation failed.");
        const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
        console.error("Cancel Order error:", err);
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

        {/* User Balances */}
        <Box mb={6} p={4} borderRadius="xl" boxShadow="md" bg="gray.100" display="flex" flexDirection="column" alignItems="center">
          <Text fontSize="lg" fontWeight="bold" color="gray.700" mb={1}>Your Balances</Text>
          <Flex gap={8}>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.400">TokenA</Text>
              <Text fontSize="md" color="blue.700" fontWeight="semibold">{balanceA}</Text>
            </Box>
            <Box textAlign="center">
              <Text fontSize="xs" color="gray.400">TokenB</Text>
              <Text fontSize="md" color="green.700" fontWeight="semibold">{balanceB}</Text>
            </Box>
          </Flex>
        </Box>

        <Heading size="md" mb={4}>Create Limit Order</Heading>
        <Stack spacing={3} mb={6}>
            <Select value={tokenInAddress} onChange={e => setTokenInAddress(e.target.value)}>
                {Object.values(APP_TOKENS).map(token => (
                    <option key={token.address} value={token.address}>{token.symbol}</option>
                ))}
            </Select>
            <Select value={tokenOutAddress} onChange={e => setTokenOutAddress(e.target.value)}>
                {Object.values(APP_TOKENS)
                    .filter(token => token.address !== tokenInAddress)
                    .map(token => (
                        <option key={token.address} value={token.address}>{token.symbol}</option>
                    ))}
            </Select>
            <Input
                value={amountIn}
                type="number"
                min="0"
                onChange={e => setAmountIn(e.target.value)}
                placeholder={`Amount of ${APP_TOKENS[tokenInAddress].symbol} to sell`}
            />
            <Input
                value={amountOutMin}
                type="number"
                min="0"
                onChange={e => setAmountOutMin(e.target.value)}
                placeholder={`Minimum ${APP_TOKENS[tokenOutAddress].symbol} to receive (Limit Price)`}
            />
        </Stack>
        <Button w="100%" colorScheme="purple" onClick={handleCreateOrder} isLoading={isLoading}>Create Order</Button>

        {txStatus && (<Text mt={3} color="red.400" fontSize="sm">{txStatus}</Text>)}
        {isLoading && txStatus === "" && <Spinner mt={3} size="sm" color="blue.500" />}

        <Heading size="sm" mt={8} mb={4}>Your Open Orders</Heading>
        {userOrders.length === 0 ? (
            <Text textAlign="center" color="gray.500">No open orders.</Text>
        ) : (
            <Stack spacing={3}>
                {userOrders.map(order => (
                    <Box key={order.id} p={3} borderWidth="1px" borderRadius="lg" bg="gray.50">
                        <Text>Order ID: {order.id.toString()}</Text>
                        <Text>Sell: {ethers.formatUnits(order.amountIn, APP_TOKENS[order.tokenIn].decimals)} {APP_TOKENS[order.tokenIn].symbol}</Text>
                        <Text>Min Receive: {ethers.formatUnits(order.amountOutMin, APP_TOKENS[order.tokenOut].decimals)} {APP_TOKENS[order.tokenOut].symbol}</Text>
                        <Text>Status: {OrderStatus[order.status]}</Text>
                        {order.status === 0 && (
                            <Button size="sm" mt={2} colorScheme="red" onClick={() => handleCancelOrder(order.id)}>Cancel</Button>
                        )}
                    </Box>
                ))}
            </Stack>
        )}
      </Box>
    </Flex>
  );
}

export default LimitOrder;