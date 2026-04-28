import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Edit2, Eye, List, X, Search, FileText, ChevronRight, Hash } from "lucide-react";
import { cn } from "./lib/utils";

// --- Helpers ---

// A very simple slug generator that preserves Arabic characters
function createSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, "-")
    // Keep Arabic letters, numbers, and Latin letters
    .replace(/[^\\w\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\-]+/g, "")
    .replace(/\\-\\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Override marked renderer to add IDs to headings automatically
const renderer = new marked.Renderer();
renderer.heading = function (text, level, raw) {
  // text here can contain HTML if marked parsed inner elements, so we use raw for the slug
  const id = createSlug(raw);
  return \`<h\${level} id="\${id}">\${text}</h\${level}>\`;
};
marked.setOptions({ renderer });

const DEFAULT_CONTENT = \`# محرر الكتب والملفات الضخمة

أهلاً بك في هذا المحرر الذي تمت إعادة بنائه بالكامل ليدعم الملفات التي تصل إلى 500 صفحة بدون أي لاج (Lag).

## ما الذي تم إصلاحه؟
1. **سرعة الكتابة:** الكتابة الآن فورية، لأننا فصلنا واجهة العرض عن مربع النص. يمكنك كتابة آلاف الأسطر ولن تشعر بأي بطء.
2. **الفهرس الخفيف:** الفهرس الآن يعمل بشكل ممتاز. عند الضغط عليه لن يصعد إلى بداية الصفحة ولن يفتح الكيبورد بشكل مزعج.
3. **البحث السريع:** تمت إضافة أداة بحث قوية وفائقة السرعة في القائمة الجانبية لتتمكن من إيجاد أي كلمة والقفز إليها في المحرر فوراً.

## جرب الآن
يمكنك لصق كتاب كامل هنا وتجربة البحث السريع والتنقل عبر الفهرس.
\`;

export default function App() {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [sidebarTab, setSidebarTab] = useState<"toc" | "search">("toc");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // The 'debounced' state is ONLY used for preview and TOC to avoid lagging the typing.
  const [debouncedContent, setDebouncedContent] = useState(DEFAULT_CONTENT);
  
  // Refs for tracking DOM and state without re-rendering
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shadowDivRef = useRef<HTMLDivElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ index: number; snippet: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Handlers ---

  // Handle typing extremely fast without React state updates blocking the thread
  const handleInput = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // Update the preview after 1 second of NO typing.
    typingTimeoutRef.current = setTimeout(() => {
      if (textareaRef.current) {
        setDebouncedContent(textareaRef.current.value);
      }
    }, 1000);
  }, []);

  // Compute HTML for preview using marked and DOMPurify for extreme speed compared to React components
  const previewHtml = useMemo(() => {
    try {
      const rawHtml = marked.parse(debouncedContent) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      return "<p>خطأ في عرض المحتوى</p>";
    }
  }, [debouncedContent]);

  // Compute TOC extremely fast using RegExp directly on the text
  const toc = useMemo(() => {
    const headings: { id: string; text: string; level: number }[] = [];
    // This matches markdown headings smoothly
    const regex = /^(#{1,6})\\s+(.+)$/gm;
    let match;
    // Prevent infinite loops safely
    let loopCount = 0;
    while ((match = regex.exec(debouncedContent)) !== null && loopCount < 10000) {
      loopCount++;
      const text = match[2];
      const level = match[1].length;
      const id = createSlug(text);
      if (id) {
        headings.push({ id, text, level });
      }
    }
    return headings;
  }, [debouncedContent]);

  // Execute fast string search
  const runSearch = useCallback((query: string) => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value;
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const results = [];
    let index = lowerText.indexOf(lowerQuery);
    
    // Limit to 100 results max for UI performance
    while (index !== -1 && results.length < 100) {
      const start = Math.max(0, index - 30);
      const end = Math.min(text.length, index + query.length + 30);
      let snippet = text.substring(start, end).replace(/\\n/g, " ");
      results.push({ index, snippet });
      index = lowerText.indexOf(lowerQuery, index + 1);
    }
    
    setSearchResults(results);
    setIsSearching(false);
  }, []);

  // Handle Search Input
  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsSearching(true);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      runSearch(query);
    }, 400); // 400ms debounce
  };

  // Jump smoothly to a TOC heading in Preview
  const handleTocClick = (id: string) => {
    // 1. Ensure we hide keyboard without messing up scroll
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 2. We must be in preview to see headings
    if (activeTab === "edit") {
      setActiveTab("preview");
    }

    // 3. Scroll to element securely. Wait for DOM update if tab just changed.
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        // Find parent scroll container
        const container = document.getElementById("preview-container");
        if (container) {
          // Calculate relative position
          const top = el.offsetTop - 20; // 20px padding
          container.scrollTo({ top, behavior: "smooth" });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 100);

    // 4. Close sidebar on mobile
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  // Jump directly to textarea specific index based on search
  const handleSearchJump = (index: number) => {
    const textarea = textareaRef.current;
    const shadow = shadowDivRef.current;
    if (!textarea || !shadow) return;

    // Switch to edit if not already
    if (activeTab !== "edit") {
      setActiveTab("edit");
    }

    // A fast hack to scroll the textarea precisely without focusing it and opening keyboard
    // 1. Put the text up to the 'index' inside the shadow div
    const textBefore = textarea.value.substring(0, index);
    shadow.textContent = textBefore;
    
    // 2. Measure the height
    const heightBefore = shadow.scrollHeight;
    
    // 3. Scroll the textarea
    // We center the match in the viewport roughly
    const offset = Math.max(0, heightBefore - (textarea.clientHeight / 2));
    
    // Use setTimeout so the UI tab switch finishes first
    setTimeout(() => {
      textarea.scrollTo({ top: offset, behavior: "smooth" });
      
      // Select the text (does NOT trigger keyboard on mobile if we don't call focus())
      textarea.setSelectionRange(index, index + searchQuery.length);
    }, 50);

    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex bg-gray-50 h-screen w-full font-sans antialiased overflow-hidden" dir="rtl">
      
      {/* --- Sidebar (TOC & Search) --- */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-80 bg-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none lg:border-l border-gray-200 flex flex-col shrink-0",
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Sidebar Header Options */}
        <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
          <button
            onClick={() => setSidebarTab("toc")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors",
              sidebarTab === "toc" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-800"
            )}
          >
            <List className="w-4 h-4" /> الفهرس
          </button>
          <button
            onClick={() => setSidebarTab("search")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors",
              sidebarTab === "search" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-800"
            )}
          >
            <Search className="w-4 h-4" /> البحث
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-200 rounded-md shrink-0 mr-1"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="flex-1 overflow-y-auto w-full relative">
          
          {/* Table of Contents View */}
          {sidebarTab === "toc" && (
            <div className="p-4 space-y-1">
              {toc.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <Hash className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">لا توجد عناوين في المستند</p>
                </div>
              ) : (
                toc.map((heading, i) => (
                  <button
                    key={i}
                    onClick={() => handleTocClick(heading.id)}
                    className={cn(
                      "w-full text-right block text-sm text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md px-3 py-2 transition-colors",
                      heading.level === 1 && "font-bold mt-3 text-base text-gray-900 border-b border-gray-100 pb-1 rounded-none",
                      heading.level === 2 && "mr-3 font-semibold",
                      heading.level === 3 && "mr-6 text-sm",
                      heading.level === 4 && "mr-9 text-xs opacity-80",
                      heading.level >= 5 && "mr-12 text-xs opacity-60"
                    )}
                  >
                    {heading.text}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Search View */}
          {sidebarTab === "search" && (
            <div className="flex flex-col h-full bg-white">
              <div className="p-4 border-b border-gray-100 shrink-0 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    placeholder="ابحث في الكتاب..."
                    className="w-full bg-gray-100 border-none rounded-lg pr-10 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium text-gray-800"
                  />
                </div>
                {searchQuery && !isSearching && (
                  <p className="text-xs text-gray-500 mt-2 pr-1 font-medium">
                    {searchResults.length === 100 ? "+100 نتيجة" : \`\${searchResults.length} نتائج\`}
                  </p>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-gray-500 animate-pulse">جاري البحث...</div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((res, i) => {
                      // Highlight the matched query
                      const matchIdx = res.snippet.toLowerCase().indexOf(searchQuery.toLowerCase());
                      const before = res.snippet.substring(0, matchIdx);
                      const match = res.snippet.substring(matchIdx, matchIdx + searchQuery.length);
                      const after = res.snippet.substring(matchIdx + searchQuery.length);

                      return (
                        <button
                          key={i}
                          onClick={() => handleSearchJump(res.index)}
                          className="w-full text-right text-sm p-3 rounded-lg hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all group"
                        >
                          <p className="text-gray-600 leading-relaxed max-h-16 overflow-hidden line-clamp-2">
                            {before}
                            <mark className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-bold">{match}</mark>
                            {after}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : searchQuery ? (
                  <div className="p-8 text-center text-gray-500 text-sm">لا توجد نتائج مطابقة</div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center">
                    <Search className="w-8 h-8 mb-2 opacity-20" />
                    اكتب للبحث السريع في كامل المستند
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen relative">
        
        {/* Top App Bar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 z-20">
          
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 font-semibold text-sm lg:hidden"
          >
            <List className="w-5 h-5" /> <span>القائمة</span>
          </button>
          
          <div className="hidden lg:flex items-center gap-2 px-2 text-gray-600 font-bold text-lg">
            <FileText className="w-5 h-5 text-blue-600" /> محرر الكتب السريع
          </div>

          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200/60">
            <button
              onClick={() => setActiveTab("edit")}
              className={cn(
                "flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-bold transition-all",
                activeTab === "edit"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Edit2 className="w-4 h-4" />
              تعديل
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "flex items-center gap-2 px-5 py-1.5 rounded-md text-sm font-bold transition-all",
                activeTab === "preview"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Eye className="w-4 h-4" />
              معاينة
            </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-white">
          
          {/* -- EDITOR VIEW -- */}
          <div
            className={cn(
              "flex-1 flex flex-col relative",
              activeTab === "edit" ? "flex" : "hidden lg:flex"
            )}
          >
            {/* The Textarea is UNCONTROLLED for performance. It uses defaultValue and onInput. */}
            <textarea
              ref={textareaRef}
              defaultValue={DEFAULT_CONTENT}
              onInput={handleInput}
              placeholder="اكتب هنا بحرية تامة..."
              className="flex-1 w-full p-6 lg:p-10 resize-none outline-none text-gray-800 lg:text-lg leading-[1.8] bg-transparent font-medium"
              spellCheck="false"
            />
            
            {/* A hidden DOM element used exactly to measure scroll heights matching the textarea */}
            <div 
              ref={shadowDivRef}
              className="absolute top-0 left-0 -z-10 invisible whitespace-pre-wrap break-words w-full p-6 lg:p-10 lg:text-lg leading-[1.8] font-medium opacity-0 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* -- PREVIEW VIEW -- */}
          <div
            id="preview-container"
            className={cn(
              "flex-1 overflow-y-auto bg-gray-50 lg:border-r border-gray-200 scroll-smooth",
              activeTab === "preview" ? "block" : "hidden lg:block lg:max-w-[50%]"
            )}
          >
            <div className="p-6 lg:p-10 max-w-3xl mx-auto bg-white lg:shadow-sm lg:my-6 rounded-xl border border-transparent lg:border-gray-200 min-h-full">
              <div 
                className="prose prose-blue prose-lg max-w-none text-gray-800 prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-blue-600 prose-img:rounded-xl prose-pre:bg-gray-100 prose-pre:text-gray-800" 
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </main>
      </div>
      
      {/* Overlay indicating sidebar is open on mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/40 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

