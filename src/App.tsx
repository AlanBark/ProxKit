import {HeroUIProvider} from "@heroui/react";

function App() {
  return (
    <HeroUIProvider>
    <div className="flex flex-col h-screen max-h-screen">
      <div className="w-full bg-red-500 p-4">
        Header
      </div>
      <div className="w-full bg-blue-500 flex-grow p-4 overflow-auto">
        File Viewing Area
      </div>
      <div className="w-full bg-green-500 p-4 ">
        Footer
      </div>
    </div>

    </HeroUIProvider>
  );
}

export default App
