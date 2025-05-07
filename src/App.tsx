import VoipCall from "./components/VoipCall";
import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col py-12">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-800">
        VOIP Communication App
      </h1>
      <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto px-4">
        Make browser-to-browser calls without using phone numbers. Enter your
        identity, initialize the client, and call another user by their
        identity.
      </p>
      <VoipCall />
    </div>
  );
}

export default App;
