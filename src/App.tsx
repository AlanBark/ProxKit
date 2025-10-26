import { HeroUIProvider } from "@heroui/react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@heroui/react";
import { Download, Printer, Check, Image as ImageIcon } from "lucide-react";
import { PDFSession } from "./utils/pdf/pdfSession";
import { CardList } from "./components/CardList";
import { FileUpload } from "./components/FileUpload";
import type { CardImage } from "./types/card";
import { CARD_DIMENSIONS } from "./types/card";
import { buttonStyles, inputStyles, textStyles, backgroundStyles } from "./theme/classNames";

function App() {
  const [cards, setCards] = useState<CardImage[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfSessionRef = useRef<PDFSession | null>(null);

  // Settings
  const [defaultBleed, setDefaultBleed] = useState<number>(CARD_DIMENSIONS.standardBleed);
  const [cardWidth, setCardWidth] = useState<number>(CARD_DIMENSIONS.width);
  const [cardHeight, setCardHeight] = useState<number>(CARD_DIMENSIONS.height);
  const [pageSize, setPageSize] = useState<"A4" | "Letter">("A4");

  // Initialize PDF session
  useEffect(() => {
    pdfSessionRef.current = new PDFSession();
    return () => {
      pdfSessionRef.current?.dispose();
    };
  }, []);

  // Reinitialize PDF session when page size changes
  useEffect(() => {
    if (pdfSessionRef.current) {
      pdfSessionRef.current.dispose();
    }
    const pageSettings = pageSize === "A4"
      ? { width: 210, height: 297, margin: 10 }
      : { width: 215.9, height: 279.4, margin: 10 };
    pdfSessionRef.current = new PDFSession(pageSettings);
  }, [pageSize]);

  // Auto-generate PDF whenever cards change
  useEffect(() => {
    const generatePDF = async () => {
      if (!pdfSessionRef.current || cards.length === 0) {
        setPdfUrl(null);
        return;
      }

      setIsGenerating(true);
      try {
        const url = await pdfSessionRef.current.generatePDF();
        setPdfUrl(url);
      } catch (error) {
        console.error("Failed to generate PDF:", error);
      } finally {
        setIsGenerating(false);
      }
    };

    generatePDF();
  }, [cards]);

  const handleFilesSelected = async (files: File[]) => {
    const newCards: CardImage[] = await Promise.all(
      files.map(async (file) => {
        const imageUrl = URL.createObjectURL(file);
        const card: CardImage = {
          id: crypto.randomUUID(),
          imageUrl,
          name: file.name,
          bleed: defaultBleed,
        };
        pdfSessionRef.current?.addCard(card);
        return card;
      })
    );

    setCards((prev) => [...prev, ...newCards]);
  };

  const handleRemoveCard = (cardId: string) => {
    pdfSessionRef.current?.removeCard(cardId);
    setCards((prev) => {
      const card = prev.find((c) => c.id === cardId);
      if (card) {
        URL.revokeObjectURL(card.imageUrl);
      }
      return prev.filter((c) => c.id !== cardId);
    });
  };

  const handleUpdateBleed = (cardId: string, bleed: number) => {
    pdfSessionRef.current?.updateCardBleed(cardId, bleed);
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, bleed } : card))
    );
  };

  const handleDuplicateCard = (cardToDuplicate: CardImage) => {
    const newCard: CardImage = {
      id: crypto.randomUUID(),
      imageUrl: cardToDuplicate.imageUrl,
      name: cardToDuplicate.name,
      bleed: cardToDuplicate.bleed,
    };
    pdfSessionRef.current?.addCard(newCard);
    setCards((prev) => [...prev, newCard]);
  };

  const handleDownloadPDF = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `card-sheet-${new Date().getTime()}.pdf`;
    link.click();
  };

  const handlePrintPDF = () => {
    if (!pdfUrl) return;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    };
  };

  return (
    <HeroUIProvider>
      <div className={`flex h-screen ${backgroundStyles.app}`}>
        {/* Settings Sidebar - Left Side */}
        <div className={`w-80 ${backgroundStyles.surface} backdrop-blur-sm border-r border-[var(--border)] p-6 flex flex-col gap-6`}>
          {/* Title */}
          <div className="text-center pb-4 border-b border-[var(--border)]">
            <h1 className={`text-2xl font-bold ${textStyles.primary}`}>Proxy Print and Cut</h1>
            {cards.length > 0 && (
              <div className={`mt-2 text-xs ${textStyles.secondary}`}>
                {cards.length} card{cards.length !== 1 ? "s" : ""} loaded
                {isGenerating && " • Generating..."}
                {pdfUrl && !isGenerating && " • Ready"}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className={`${backgroundStyles.elevated} rounded-xl p-5 border border-[var(--border)]`}>
            <h3 className={`${textStyles.primary} font-semibold mb-4 text-sm uppercase tracking-wider`}>
              Actions
            </h3>
            <div className="flex flex-col gap-3">
              <FileUpload onFilesSelected={handleFilesSelected} />
              <Button
                onPress={handleDownloadPDF}
                isDisabled={!pdfUrl || isGenerating}
                className={`w-full ${buttonStyles.primary} font-semibold py-3 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />
                  Download PDF
                </span>
              </Button>
              <Button
                onPress={handlePrintPDF}
                isDisabled={!pdfUrl || isGenerating}
                className={`w-full ${buttonStyles.ghost} font-semibold py-3 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Printer className="w-5 h-5" />
                  Print
                </span>
              </Button>
            </div>
          </div>

          {/* File Settings */}
          <div className={`${backgroundStyles.elevated} rounded-xl p-5 border border-[var(--border)]`}>
            <h3 className={`${textStyles.primary} font-semibold mb-4 text-sm uppercase tracking-wider`}>
              File Settings
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${textStyles.secondary} block mb-2`}>Page Size</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as "A4" | "Letter")}
                  className={`w-full ${inputStyles.default} rounded-lg px-3 py-2 text-sm focus:outline-none`}
                >
                  <option value="A4">A4 (210×297mm)</option>
                  <option value="Letter">Letter (216×279mm)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card Settings */}
          <div className={`${backgroundStyles.elevated} rounded-xl p-5 border border-[var(--border)]`}>
            <h3 className={`${textStyles.primary} font-semibold mb-4 text-sm uppercase tracking-wider`}>
              Card Settings
            </h3>
            <div className="space-y-3">
              <div>
                <label className={`text-xs ${textStyles.secondary} block mb-2`}>Width</label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="200"
                    step="0.1"
                    value={cardWidth}
                    onChange={(e) => setCardWidth(parseFloat(e.target.value) || CARD_DIMENSIONS.width)}
                    className={`w-full ${inputStyles.default} rounded-lg px-3 py-2 text-sm focus:outline-none pr-10`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${textStyles.muted} text-sm`}>mm</span>
                </div>
              </div>
              <div>
                <label className={`text-xs ${textStyles.secondary} block mb-2`}>Height</label>
                <div className="relative">
                  <input
                    type="number"
                    min="10"
                    max="300"
                    step="0.1"
                    value={cardHeight}
                    onChange={(e) => setCardHeight(parseFloat(e.target.value) || CARD_DIMENSIONS.height)}
                    className={`w-full ${inputStyles.default} rounded-lg px-3 py-2 text-sm focus:outline-none pr-10`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${textStyles.muted} text-sm`}>mm</span>
                </div>
              </div>
              <div>
                <label className={`text-xs ${textStyles.secondary} block mb-2`}>Default Bleed</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={defaultBleed}
                    onChange={(e) => setDefaultBleed(parseFloat(e.target.value) || 0)}
                    className={`w-full ${inputStyles.default} rounded-lg px-3 py-2 text-sm focus:outline-none pr-10`}
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${textStyles.muted} text-sm`}>mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          {(isGenerating || pdfUrl) && (
            <div className={`${backgroundStyles.elevated} rounded-xl p-5 border border-[var(--border)]`}>
              <h3 className={`${textStyles.primary} font-semibold mb-3 text-sm uppercase tracking-wider`}>
                Status
              </h3>
              {isGenerating ? (
                <div className={`flex items-center gap-3 ${textStyles.warning}`}>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--warning)] border-t-transparent"></div>
                  <span className="text-sm">Generating PDF...</span>
                </div>
              ) : pdfUrl ? (
                <div className={`flex items-center gap-3 ${textStyles.success}`}>
                  <Check className="w-5 h-5" />
                  <span className="text-sm">PDF Ready</span>
                </div>
              ) : null}
            </div>
          )}

          {/* Footer - Credits */}
          <div className={`mt-auto pt-6 border-t border-[var(--border)]`}>
            <p className={`${textStyles.muted} text-xs text-center`}>
              Made for Silhouette Cameo
            </p>
            <p className={`${textStyles.muted} text-xs text-center mt-1 opacity-60`}>
              © {new Date().getFullYear()} Alec Parkes
            </p>
          </div>
        </div>

        {/* Main Content Area - Right Side */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Cards Grid */}
          <div className={`flex-1 ${backgroundStyles.surface} backdrop-blur-sm rounded-2xl border border-[var(--border)] overflow-hidden`}>
            <div className="h-full overflow-auto p-6">
              {cards.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-full ${textStyles.muted}`}>
                  <ImageIcon className="w-24 h-24 mb-4 opacity-30" />
                  <p className="text-lg">No cards yet</p>
                  <p className="text-sm mt-1">Upload images to get started</p>
                </div>
              ) : (
                <CardList
                  cards={cards}
                  onRemoveCard={handleRemoveCard}
                  onUpdateBleed={handleUpdateBleed}
                  onDuplicateCard={handleDuplicateCard}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </HeroUIProvider>
  );
}

export default App;
