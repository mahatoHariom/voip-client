import { useState } from "react";
import VoipCall from "./components/VoipCall";
import Conference from "./components/Conference";
import "./App.css";

type TabType = "1to1" | "conference";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("1to1");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col py-12">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-800">
        VOIP Communication App
      </h1>
      <p className="text-center text-gray-600 mb-6 max-w-2xl mx-auto px-4">
        Make browser-to-browser calls without using phone numbers.
      </p>

      {/* Tab Selector */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
          <button
            className={`px-4 py-2 rounded-md ${
              activeTab === "1to1"
                ? "bg-blue-100 text-blue-800 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("1to1")}
          >
            1:1 Call
          </button>
          <button
            className={`px-4 py-2 rounded-md ${
              activeTab === "conference"
                ? "bg-blue-100 text-blue-800 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab("conference")}
          >
            Conference
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="max-w-md mx-auto w-full">
        {activeTab === "1to1" ? <VoipCall /> : <Conference />}
      </div>
    </div>
  );
}

export default App;
