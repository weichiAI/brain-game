import { Route, Routes } from "react-router-dom";
import Home from "./pages/home";
import NotFound from "./pages/not-found";
import DigitSpanTest from "./pages/test/digit-span";
import ReactionTimeTest from "./pages/test/reaction-time";
import StroopTest from "./pages/test/stroop";
import SequenceMemoryTest from "./pages/test/sequence-memory";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/test/digit-span" element={<DigitSpanTest />} />
      <Route path="/test/reaction-time" element={<ReactionTimeTest />} />
      <Route path="/test/stroop" element={<StroopTest />} />
      <Route path="/test/sequence-memory" element={<SequenceMemoryTest />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
