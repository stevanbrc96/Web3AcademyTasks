import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Swap from "./components/Swap";
import Liquidity from "./components/Liquidity";
import LimitOrder from "./components/LimitOrder"; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Swap />} />
        <Route path="/liquidity" element={<Liquidity />} />
        <Route path="/limit-orders" element={<LimitOrder />} /> {}
      </Routes>
    </Router>
  );
}

export default App;