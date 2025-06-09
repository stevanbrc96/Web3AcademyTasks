
import RouterJSON from "./AMMRouter.json"; 
import PairJSON from "./AMMPair.json";     
import TokenJSON from "./TokenA.json";      
import FactoryJSON from "./AMMFactory.json"; 
import OrderBookJSON from "./OrderBook.json";


export const FACTORY_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; 
export const ROUTER_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";   
export const TOKEN_A_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 
export const TOKEN_B_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; 
export const ORDER_BOOK_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"; 

export const RouterABI = RouterJSON.abi;
export const PairABI = PairJSON.abi;
export const TokenABI = TokenJSON.abi; 
export const FactoryABI = FactoryJSON.abi; 
export const OrderBookABI = OrderBookJSON.abi;