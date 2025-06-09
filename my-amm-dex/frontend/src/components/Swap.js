
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
  Select,
  Text,
  Flex,
  Link,
  Spinner, 
} from "@chakra-ui/react";
import { toast } from "react-hot-toast";

import PriceChart from "./PriceChart"; 

const APP_TOKENS = {
  [TOKEN_A_ADDRESS]: { address: TOKEN_A_ADDRESS, decimals: 18, symbol: "TokenA" },
  [TOKEN_B_ADDRESS]: { address: TOKEN_B_ADDRESS, decimals: 18, symbol: "TokenB" },
};

function Swap() {
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenInAddress, setTokenInAddress] = useState(TOKEN_A_ADDRESS);
  const [tokenOutAddress, setTokenOutAddress] = useState(TOKEN_B_ADDRESS);
  const [balanceA, setBalanceA] = useState("0");
  const [balanceB, setBalanceB] = useState("0");
  const [reserveA, setReserveA] = useState("0");
  const [reserveB, setReserveB] = useState("0");
  const [estimatedOut, setEstimatedOut] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [currentPairAddress, setCurrentPairAddress] = useState(ethers.ZeroAddress); 
  const [isLoading, setIsLoading] = useState(false); 
  const [priceChartData, setPriceChartData] = useState([]); 


  const getEstimatedOutput = useCallback((inputAmount, inputReserve, outputReserve) => {
    if (!inputAmount || !inputReserve || !outputReserve || inputReserve === 0) return 0;
    const amtInWithFee = inputAmount * 997; 
    const numerator = amtInWithFee * outputReserve;
    const denominator = (inputReserve * 1000) + amtInWithFee;
    return numerator / denominator;
  }, []);

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

  const fetchPriceHistory = useCallback(async (_provider, _pairAddress, _pairToken0Address, _tokenAAddress, _tokenBAddress) => {
    if (!_provider || _pairAddress === ethers.ZeroAddress) return;

    try {
      const pairContract = new ethers.Contract(_pairAddress, PairABI, _provider);
      const filter = pairContract.filters.Swap(); 

      const logs = await pairContract.queryFilter(filter, 0, "latest");

      const prices = [];
      for (const log of logs) {
        const { amount0In, amount1In, amount0Out, amount1Out } = log.args;
        const blockNumber = log.blockNumber;

        let inputAmountRaw, outputAmountRaw;
        const isTokenA_token0 = (_tokenAAddress === _pairToken0Address);

        let priceValue; 
        
        if (isTokenA_token0) {
          if (amount0In > BigInt(0)) { 
            inputAmountRaw = amount0In;
            outputAmountRaw = amount1Out;
          } else if (amount1In > BigInt(0)) { 
            inputAmountRaw = amount1In;
            outputAmountRaw = amount0Out;
          } else { 
              continue;
          }
          priceValue = (parseFloat(ethers.formatUnits(outputAmountRaw, APP_TOKENS[_tokenBAddress].decimals)) / 
                        parseFloat(ethers.formatUnits(inputAmountRaw, APP_TOKENS[_tokenAAddress].decimals)));
        } else { 
          if (amount0In > BigInt(0)) { 
            inputAmountRaw = amount0In;
            outputAmountRaw = amount1Out;
          } else if (amount1In > BigInt(0)) { 
            inputAmountRaw = amount1In;
            outputAmountRaw = amount0Out;
          } else { 
              continue;
          }
          priceValue = (parseFloat(ethers.formatUnits(outputAmountRaw, APP_TOKENS[_tokenBAddress].decimals)) / 
                        parseFloat(ethers.formatUnits(inputAmountRaw, APP_TOKENS[_tokenAAddress].decimals)));
        }
        
        if (!isNaN(priceValue) && isFinite(priceValue)) {
            prices.push({ blockNumber, price: priceValue });
        }
      }
      setPriceChartData(prices);
    } catch (err) {
      console.error("Error fetching price history:", err);
      setPriceChartData([]);
    }
  }, []); 

  const fetchReserves = useCallback(async (_signerOrProvider, _tokenInAddress, _tokenOutAddress) => {
    if (!_signerOrProvider || !_tokenInAddress || !_tokenOutAddress) return;
    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FactoryABI, _signerOrProvider);
      const pairAddress = await factoryContract.getPair(_tokenInAddress, _tokenOutAddress);
      setCurrentPairAddress(pairAddress);

      if (pairAddress === ethers.ZeroAddress) {
        setReserveA("0");
        setReserveB("0");
        console.warn("No liquidity pair found for selected tokens.");
        return;
      }

      const pairContract = new ethers.Contract(pairAddress, PairABI, _signerOrProvider);
      const [reserve0Raw, reserve1Raw] = await pairContract.getReserves(); 
      const token0AddressInPair = await pairContract.token0(); 

      const actualReserveARaw = (TOKEN_A_ADDRESS === token0AddressInPair) ? reserve0Raw : reserve1Raw;
      const actualReserveBRaw = (TOKEN_B_ADDRESS === token0AddressInPair) ? reserve0Raw : reserve1Raw;
      
      setReserveA(ethers.formatUnits(actualReserveARaw, APP_TOKENS[TOKEN_A_ADDRESS].decimals));
      setReserveB(ethers.formatUnits(actualReserveBRaw, APP_TOKENS[TOKEN_B_ADDRESS].decimals));

      if (pairAddress !== ethers.ZeroAddress) {
        await fetchPriceHistory(_signerOrProvider, pairAddress, token0AddressInPair, TOKEN_A_ADDRESS, TOKEN_B_ADDRESS);
      }

    } catch (err) {
      console.error("Error fetching reserves:", err);
      setReserveA("0");
      setReserveB("0");
    }
  }, [fetchPriceHistory]); 


  const updateEstimatedOut = useCallback(() => {
    const input = Number(amount);
    
    let inputReserveParsed, outputReserveParsed;
    if (tokenInAddress === TOKEN_A_ADDRESS) {
      inputReserveParsed = Number(reserveA);
      outputReserveParsed = Number(reserveB);
    } else {
      inputReserveParsed = Number(reserveB);
      outputReserveParsed = Number(reserveA);
    }
    
    if (input > 0 && inputReserveParsed > 0 && outputReserveParsed > 0) {
      const estimated = getEstimatedOutput(input, inputReserveParsed, outputReserveParsed);
      const outputTokenDecimals = APP_TOKENS[tokenOutAddress].decimals;
      setEstimatedOut(estimated.toFixed(outputTokenDecimals));
    } else {
      setEstimatedOut("");
    }
  }, [amount, tokenInAddress, tokenOutAddress, reserveA, reserveB, getEstimatedOutput]);

  useEffect(() => {
    if (provider && signer && account) {
      fetchBalances(account, signer);
      fetchReserves(signer, tokenInAddress, tokenOutAddress); 
    }
  }, [account, signer, provider, tokenInAddress, tokenOutAddress, fetchBalances, fetchReserves]);

  useEffect(() => {
    updateEstimatedOut();
  }, [amount, reserveA, reserveB, tokenInAddress, tokenOutAddress, updateEstimatedOut]);


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
        await fetchReserves(signerInstance, tokenInAddress, tokenOutAddress); 

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

  const handleSwap = async () => {
    if (!signer) {
      toast.error("Please connect your wallet first!");
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (tokenInAddress === tokenOutAddress) {
      toast.error("Select different tokens to swap.");
      return;
    }
    if (currentPairAddress === ethers.ZeroAddress || Number(reserveA) === 0 || Number(reserveB) === 0) {
      toast.error("No liquidity pool or insufficient liquidity for this token pair.");
      return;
    }
    if (Number(amount) > (tokenInAddress === TOKEN_A_ADDRESS ? Number(balanceA) : Number(balanceB))) {
      toast.error("Insufficient balance for swap.");
      return;
    }


    try {
      setIsLoading(true);
      setTxStatus("Approving...");

      const tokenInInfo = APP_TOKENS[tokenInAddress];
      const tokenOutInfo = APP_TOKENS[tokenOutAddress];

      const tokenInContract = new ethers.Contract(tokenInAddress, TokenABI, signer);
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, RouterABI, signer);

      const amountInWei = ethers.parseUnits(amount, tokenInInfo.decimals);

      const approveTx = await tokenInContract.approve(ROUTER_ADDRESS, amountInWei);
      await approveTx.wait();
      toast.success("Approval successful!");

      setTxStatus("Swapping...");
      
      const path = [tokenInAddress, tokenOutAddress];
      const to = account;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 10; 
      
      const slippage = 1; 
      const amountOutMinParsed = (Number(estimatedOut) * (100 - slippage) / 100);
      const amountOutMinWei = ethers.parseUnits(
          amountOutMinParsed.toFixed(tokenOutInfo.decimals), 
          tokenOutInfo.decimals
      );
      
      console.log(`Swapping ${amount} ${tokenInInfo.symbol} for at least ${amountOutMinParsed.toFixed(tokenOutInfo.decimals)} ${tokenOutInfo.symbol}`);
      console.log(`Amount In (Wei): ${amountInWei.toString()}`);
      console.log(`Amount Out Min (Wei): ${amountOutMinWei.toString()}`);

      const swapTx = await routerContract.swapExactTokensForTokens(
        amountInWei,
        amountOutMinWei,
        path,
        to,
        deadline
      );
      
      await swapTx.wait();

      toast.success("Swap complete!");
      setTxStatus("");
      await fetchBalances(account, signer);
      await fetchReserves(signer, tokenInAddress, tokenOutAddress); 

    } catch (err) {
      setTxStatus("Transaction failed.");
      const errorMessage = err?.info?.error?.message || err?.reason || err?.message || "Unknown error";
      console.error("Swap error:", err); 
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
        </Box>
        <Heading size="md" mb={4}>Swap</Heading>
        <Flex gap={2} mb={4}>
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
        </Flex>
        <Input mb={3} value={amount} type="number" min="0" onChange={e => setAmount(e.target.value)} placeholder="Amount"/>
        {estimatedOut && (
          <Text mb={3} fontSize="sm" color="gray.700">Estimated Received: {estimatedOut}</Text>
        )}
        <Button w="100%" colorScheme="blue" onClick={handleSwap} isLoading={isLoading}>Swap</Button>
        {txStatus && (<Text mt={3} color="red.400" fontSize="sm">{txStatus}</Text>)}
        {isLoading && txStatus === "" && <Spinner mt={3} size="sm" color="blue.500" />} 

        {}
        <Box mt={8}>
            <Heading size="md" mb={4}>Price Chart</Heading>
            {priceChartData.length > 0 ? (
                <PriceChart chartData={priceChartData} />
            ) : (
                <Text textAlign="center" color="gray.500">No swap history available to display price chart.</Text>
            )}
        </Box>
        {}
      </Box>
    </Flex>
  );
}

export default Swap;