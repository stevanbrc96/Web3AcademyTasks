import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Swap from "./components/Swap";
import Liquidity from "./components/Liquidity";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Swap />} />
        <Route path="/liquidity" element={<Liquidity />} />
      </Routes>
    </Router>
  );
}
export default App;
