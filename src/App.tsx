import React, { useState, useMemo, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Edit2, Eye, List, X } from "lucide-react";
import { cn } from "./lib/utils";

// Helper to generate IDs for headings, keeping Arabic characters intact.
function createSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract pure text from React elements to create slugs
function getTextFromChildren(children: any): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (children?.props?.children) {
    return getTextFromChildren(children.props.children);
  }
  return "";
}

// Custom Markdown renderers for headings with IDs
const customComponents = {
  h1: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    return (
      <h1 id={createSlug(text)} className="mt-8 mb-4 text-3xl font-bold text-gray-900" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    return (
      <h2 id={createSlug(text)} className="mt-8 mb-4 text-2xl font-bold text-gray-800" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    return (
      <h3 id={createSlug(text)} className="mt-6 mb-3 text-xl font-semibold text-gray-800" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    return (
      <h4 id={createSlug(text)} className="mt-4 mb-2 text-lg font-semibold text-gray-700" {...props}>
        {children}
      </h4>
    );
  },
  p: ({ children, ...props }: any) => (
    <p className="mb-4 text-gray-700 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="mb-4 list-disc list-inside text-gray-700 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="mb-4 list-decimal list-inside text-gray-700 space-y-1" {...props}>
      {children}
    </ol>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="my-4 border-r-4 border-blue-500 pr-4 text-gray-600 bg-gray-50 py-2 rounded-l-md" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ inline, children, ...props }: any) => {
    return (
      <code className={cn("font-mono text-sm", inline ? "bg-gray-100 text-pink-600 px-1 py-0.5 rounded" : "block bg-gray-100 p-4 rounded-lg overflow-x-auto text-gray-800 my-4")} {...props}>
        {children}
      </code>
    );
  },
};

const DEFAULT_CONTENT = `# محرر تفاعلي خفيف وسريع

أهلاً بك في هذا المحرر الذي تم تصميمه خصيصاً ليناسب الهواتف المحمولة ويعالج مشاكل الواجهة القديمة.

## المميزات الجديدة

هنا قمنا بإضافة العديد من التحسينات لجعل التجربة متكاملة وخالية من المشاكل.

### واجهة خفيفة جداً (Lightweight UI)
تم التخلي عن المكتبات الثقيلة والاعتماد على مكونات مرنة وسريعة الاستجابة لمنع حالة اللاج (Lag) أو بطء التصفح على الأجهزة الضعيفة.

### حل مشكلة الفهرس
سابقاً، عند الضغط على عنصر في الفهرس:
1. كان يتم نقلك إلى أعلى الصفحة.
2. كانت تفتح لوحة المفاتيح (Keyboard) بشكل مزعج لأن محتوى التحرير كان يكتسب التركيز (Focus).

الآن، قمنا بعمل التعديل التالي:

\`\`\`javascript
const handleTocClick = (e, id) => {
  e.preventDefault();
  // إزالة التركيز من أي حقل إدخال لإخفاء لوحة المفاتيح
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  // التمرير السلس إلى العنصر المطلوب
  document.getElementById(id)?.scrollIntoView();
}
\`\`\`

## الخاتمة والتجربة
جرب الضغط على أي عنوان في "فهرس المحتويات" (TOC) وستلاحظ أن الشاشة تصعد أو تنزل بانسيابية نحو التفاصيل دون استدعاء الكيبورد إطلاقاً.`;

export default function App() {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isTocOpen, setIsTocOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse table of contents from markdown content
  const toc = useMemo(() => {
    const lines = content.split("\n");
    const headings: { id: string; text: string; level: number }[] = [];
    for (const line of lines) {
      const match = line.match(/^(#{1,4})\s+(.*)$/);
      if (match) {
        const text = match[2];
        const level = match[1].length;
        const id = createSlug(text);
        if (id) {
          headings.push({ id, text, level });
        }
      }
    }
    return headings;
  }, [content]);

  // Handle clicking on a TOC link
  const handleTocClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();

    // 1. Remove focus from textarea so the keyboard hides immediately!
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 2. If we are on mobile edit view, switch to preview automatically to see the heading
    if (window.innerWidth < 1024 && activeTab === "edit") {
      setActiveTab("preview");
      // Wait a tick for DOM to render the preview tab before scrolling
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    } else {
      // Direct scroll
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    // Close the TOC sidebar on mobile
    if (window.innerWidth < 1024) {
      setIsTocOpen(false);
    }
  };

  return (
    // Add dir="rtl" for Arabic layout mostly
    <div className="flex bg-gray-50 h-screen w-full font-sans antialiased" dir="rtl">
      
      {/* --- Sidebar (Table of Contents) --- */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-40 w-72 bg-white shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none lg:border-l border-gray-200 flex flex-col",
          isTocOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <List className="w-5 h-5 text-blue-600" />
            فهرس المحتويات
          </h2>
          <button
            onClick={() => setIsTocOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-800 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {toc.length === 0 ? (
            <p className="text-gray-400 text-sm">لا توجد عناوين في المستند</p>
          ) : (
            toc.map((heading, i) => (
              <a
                key={i}
                href={\`#\${heading.id}\`}
                onClick={(e) => handleTocClick(e, heading.id)}
                className={cn(
                  "block text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded px-2 py-1.5 transition-colors text-right",
                  heading.level === 1 && "font-bold mt-2",
                  heading.level === 2 && "mr-4",
                  heading.level === 3 && "mr-8 text-xs",
                  heading.level === 4 && "mr-12 text-xs text-gray-500"
                )}
              >
                {heading.text}
              </a>
            ))
          )}
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen">
        
        {/* Header Options */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("edit")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "edit"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Edit2 className="w-4 h-4" />
              تعديل
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "preview"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Eye className="w-4 h-4" />
              معاينة
            </button>
          </div>

          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-1"
            title="الفهرس"
          >
            <List className="w-5 h-5" />
          </button>
        </header>

        {/* Editor and Preview Split (Side by Side on Desktop, Tabbable on Mobile) */}
        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Editor block */}
          <div
            className={cn(
              "flex-1 flex flex-col bg-white border-l border-gray-100",
              activeTab === "edit" ? "flex" : "hidden lg:flex"
            )}
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="اكتب هنا بصيغة ماركداون (Markdown)..."
              className="flex-1 w-full p-6 resize-none outline-none text-gray-800 text-lg leading-relaxed bg-transparent"
              spellCheck="false"
            />
          </div>

          {/* Preview block */}
          <div
            className={cn(
              "flex-1 overflow-y-auto bg-white lg:bg-gray-50",
              activeTab === "preview" ? "block" : "hidden lg:block lg:max-w-[50%]"
            )}
          >
            <div className="p-6 lg:p-10 max-w-3xl mx-auto bg-white lg:shadow-[0_2px_12px_rgb(0,0,0,0.04)] lg:my-6 rounded-xl border border-transparent lg:border-gray-100">
               {/* react-markdown container */}
              <div className="markdown-body" dir="rtl">
                <Markdown remarkPlugins={[remarkGfm]} components={customComponents}>
                  {content}
                </Markdown>
              </div>
            </div>
          </div>

        </main>
      </div>
      
      {/* Overlay for mobile TOC */}
      {isTocOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsTocOpen(false)}
        />
      )}
    </div>
  );
}
