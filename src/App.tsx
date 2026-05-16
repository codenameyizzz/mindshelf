/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDeferredValue, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive,
  Bookmark,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clapperboard,
  Dices,
  ExternalLink,
  Globe2,
  HardDrive,
  Inbox,
  Instagram,
  Layers,
  LibraryBig,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { detectPlatform, fetchMetadata, normalizeSavedItem } from "./services/api";
import { loadSavedItems, saveSavedItems, type StorageMode } from "./services/storage";
import { ContentCategory, ContentMetadata, ContentPlatform, SavedContent, UserStats } from "./types";

const DEFAULT_CATEGORIES: ContentCategory[] = ["Learning", "Entertainment", "Work Reference", "Other"];
const PLATFORM_FILTERS: Array<"All" | ContentPlatform> = ["All", "YouTube", "Instagram", "Web"];
const STATUS_FILTERS: Array<"inbox" | "archive"> = ["inbox", "archive"];

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  Learning: BookOpen,
  Entertainment: Clapperboard,
  "Work Reference": Briefcase,
  Other: Layers,
};

function getCategoryIcon(category: string) {
  return CATEGORY_ICONS[category] || Layers;
}

const PLATFORM_ICONS: Record<ContentPlatform, typeof Globe2> = {
  YouTube: Youtube,
  Instagram,
  Web: Globe2,
};

const PLATFORM_BADGE_STYLES: Record<ContentPlatform, string> = {
  YouTube: "border-blue-100 bg-blue-50/90 text-blue-700",
  Instagram: "border-blue-100 bg-blue-50/90 text-blue-700",
  Web: "border-blue-100 bg-blue-50/90 text-blue-700",
};

const STORAGE_LABELS: Record<StorageMode, string> = {
  indexeddb: "IndexedDB",
  localstorage: "Local Storage",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

type StatusFilter = "inbox" | "archive";

export default function App() {
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("indexeddb");
  const [savedItems, setSavedItems] = useState<SavedContent[]>([]);
  const [previewMetadata, setPreviewMetadata] = useState<ContentMetadata | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory>("Learning");
  const [reason, setReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("inbox");
  const [platformFilter, setPlatformFilter] = useState<"All" | ContentPlatform>("All");
  const [categoryFilter, setCategoryFilter] = useState<"All" | ContentCategory>("All");
  const [randomItem, setRandomItem] = useState<SavedContent | null>(null);
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const availableCategories = useMemo(() => {
    const customCategories = new Set<string>();

    savedItems.forEach((item) => {
      const category = item.category.trim();

      if (category && !DEFAULT_CATEGORIES.includes(category)) {
        customCategories.add(category);
      }
    });

    return [...DEFAULT_CATEGORIES, ...Array.from(customCategories).sort((left, right) => left.localeCompare(right))];
  }, [savedItems]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateItems() {
      try {
        const result = await loadSavedItems();

        if (cancelled) {
          return;
        }

        setSavedItems(result.items.map(normalizeSavedItem));
        setStorageMode(result.mode);

        if (result.migrated) {
          setNotice("Your existing library was moved into IndexedDB for more reliable local saving.");
        }
      } catch {
        if (!cancelled) {
          setError("The local library could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setHydrating(false);
        }
      }
    }

    hydrateItems();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrating) {
      return;
    }

    let cancelled = false;

    async function persistItems() {
      const result = await saveSavedItems(savedItems);

      if (!cancelled) {
        setStorageMode(result.mode);
      }
    }

    persistItems().catch(() => {
      if (!cancelled) {
        setError("The library could not be written to browser storage.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedItems, hydrating]);

  const stats = useMemo((): UserStats => {
    const categoryBreakdown: Record<string, number> = {};

    savedItems.forEach((item) => {
      const category = item.category.trim() || "Other";
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });

    return {
      totalSaved: savedItems.length,
      totalCompleted: savedItems.filter((item) => item.isRead).length,
      categoryBreakdown,
    };
  }, [savedItems]);

  const platformCounts = useMemo(() => {
    const counts: Record<ContentPlatform, number> = {
      YouTube: 0,
      Instagram: 0,
      Web: 0,
    };

    savedItems.forEach((item) => {
      counts[item.platform || detectPlatform(item.url, item.source)]++;
    });

    return counts;
  }, [savedItems]);

  const statusCounts = useMemo(
    () => ({
      inbox: savedItems.filter((item) => !item.isRead).length,
      archive: savedItems.filter((item) => item.isRead).length,
    }),
    [savedItems]
  );

  const filteredItems = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();

    return savedItems.filter((item) => {
      const statusMatch = statusFilter === "inbox" ? !item.isRead : item.isRead;
      const platformMatch = platformFilter === "All" || item.platform === platformFilter;
      const categoryMatch = categoryFilter === "All" || item.category === categoryFilter;
      const queryMatch =
        query.length === 0 ||
        item.title.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        item.reason.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      return statusMatch && platformMatch && categoryMatch && queryMatch;
    });
  }, [categoryFilter, deferredSearchQuery, platformFilter, savedItems, statusFilter]);

  const progressPercentage =
    stats.totalSaved > 0 ? Math.round((stats.totalCompleted / stats.totalSaved) * 100) : 0;

  async function handleFetchMetadata(event: FormEvent) {
    event.preventDefault();

    if (!url) {
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const data = await fetchMetadata(url);
      setPreviewMetadata({
        ...data,
        platform: data.platform || detectPlatform(data.url, data.source),
      });
      setSelectedCategory(availableCategories[0] || "Learning");
      setReason("");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "The link metadata could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!previewMetadata) {
      return;
    }

    const normalizedCategory = selectedCategory.trim() || "Other";

    const newItem: SavedContent = normalizeSavedItem({
      id: crypto.randomUUID(),
      url: previewMetadata.url,
      title: previewMetadata.title,
      description: previewMetadata.description,
      image: previewMetadata.imageData || previewMetadata.image || previewMetadata.thumbnail,
      originalImage: previewMetadata.image || previewMetadata.thumbnail,
      source: previewMetadata.source,
      platform: previewMetadata.platform || detectPlatform(previewMetadata.url, previewMetadata.source),
      category: normalizedCategory,
      reason,
      savedAt: Date.now(),
      isRead: false,
    });

    const existingItem = savedItems.find((item) => item.url === newItem.url);

    if (!existingItem) {
      setSavedItems((currentItems) => [newItem, ...currentItems]);
      setNotice("Saved locally in this browser.");
    } else {
      const refreshedItem: SavedContent = {
        ...existingItem,
        ...newItem,
        id: existingItem.id,
        isRead: existingItem.isRead,
        completedAt: existingItem.completedAt,
      };

      setSavedItems((currentItems) => [
        refreshedItem,
        ...currentItems.filter((item) => item.id !== existingItem.id),
      ]);
      setNotice("This link was already saved. The existing entry was refreshed.");
    }
    setPreviewMetadata(null);
    setUrl("");
    setReason("");
    setSelectedCategory(availableCategories[0] || "Learning");
    setStatusFilter("inbox");
    setPlatformFilter("All");
    setCategoryFilter("All");
  }

  function toggleRead(id: string) {
    setSavedItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              isRead: !item.isRead,
              completedAt: !item.isRead ? Date.now() : undefined,
            }
          : item
      )
    );
  }

  function deleteItem(id: string) {
    setSavedItems((currentItems) => currentItems.filter((item) => item.id !== id));
  }

  function pickRandom() {
    const unreadItems = savedItems.filter((item) => !item.isRead);

    if (unreadItems.length === 0) {
      setError("There are no unread items to pick from.");
      return;
    }

    const pickedItem = unreadItems[Math.floor(Math.random() * unreadItems.length)];
    setRandomItem(pickedItem);
    setShowRandomModal(true);
  }

  const brandPanelClass = desktopSidebarExpanded ? "px-5" : "px-3";
  const sidebarWidthClass = desktopSidebarExpanded ? "lg:w-[304px]" : "lg:w-[92px]";

  return (
    <div className="min-h-screen bg-library-base text-library-ink">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,_#f7fbff_0%,_#eef6ff_45%,_#ffffff_100%)]" />

      <div className="relative min-h-screen lg:flex">
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.button
                aria-label="Close navigation"
                className="fixed inset-0 z-30 bg-library-ink/18 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -32, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -32, opacity: 0 }}
                className="fixed inset-y-3 left-3 z-40 w-[290px] overflow-hidden rounded-[22px] border border-white/65 bg-white/72 shadow-[0_28px_80px_rgba(15,43,84,0.16)] backdrop-blur-2xl lg:hidden"
              >
                <SidebarContent
                  expanded
                  platformCounts={platformCounts}
                  stats={stats}
                  progressPercentage={progressPercentage}
                  statusCounts={statusCounts}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  platformFilter={platformFilter}
                  setPlatformFilter={setPlatformFilter}
                  availableCategories={availableCategories}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  storageMode={storageMode}
                  onClose={() => setMobileSidebarOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <aside
          className={`hidden border-r border-white/60 bg-white/58 shadow-[0_18px_60px_rgba(15,43,84,0.08)] backdrop-blur-2xl transition-[width] duration-300 lg:flex lg:flex-col ${sidebarWidthClass}`}
        >
          <div className={`flex h-full flex-col py-5 transition-all ${brandPanelClass}`}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className={`flex items-center gap-3 ${desktopSidebarExpanded ? "" : "w-full justify-center"}`}>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-library-accent text-white shadow-[0_18px_40px_rgba(37,99,235,0.25)]">
                  <LibraryBig size={22} />
                </div>
                {desktopSidebarExpanded && (
                  <div>
                    <h1 className="google-display text-[2rem] leading-none tracking-tight">MindShelf</h1>
                    <p className="mt-1 font-mono text-[10px] uppercase text-library-muted">Reference library</p>
                  </div>
                )}
              </div>

              <button
                aria-label={desktopSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/70 text-library-ink backdrop-blur-xl lg:flex"
                onClick={() => setDesktopSidebarExpanded((value) => !value)}
              >
                {desktopSidebarExpanded ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
              </button>
            </div>

            <SidebarContent
              expanded={desktopSidebarExpanded}
              platformCounts={platformCounts}
              stats={stats}
              progressPercentage={progressPercentage}
              statusCounts={statusCounts}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              platformFilter={platformFilter}
              setPlatformFilter={setPlatformFilter}
              availableCategories={availableCategories}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              storageMode={storageMode}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/55 bg-library-base/70 px-4 py-4 backdrop-blur-2xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Open navigation"
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/70 bg-white/72 shadow-[0_14px_32px_rgba(15,43,84,0.08)] backdrop-blur-xl lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <Menu size={18} />
                </button>

                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Curated reference shelf</p>
                  <h2 className="google-display text-[1.9rem] leading-none tracking-tight">Collect what keeps moving you.</h2>
                </div>
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <StoragePill mode={storageMode} />
                <button
                  onClick={pickRandom}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/72 px-4 text-sm font-semibold text-library-ink shadow-[0_14px_32px_rgba(15,43,84,0.08)] backdrop-blur-xl"
                >
                  <Dices size={16} />
                  Pick One
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            <section>
              <div className="rounded-[22px] border border-white/70 bg-white/64 p-5 shadow-[0_22px_70px_rgba(15,43,84,0.08)] backdrop-blur-2xl sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Capture</p>
                    <h3 className="google-display mt-2 text-[2.25rem] leading-[0.95] tracking-tight sm:text-[2.8rem]">
                      Save a YouTube, Instagram, or website link into one quiet grid.
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-library-muted">
                      Links, metadata, and cached thumbnails are stored locally in this browser so the library stays stable after refresh.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:min-w-[280px]">
                    <MetricCard label="Saved" value={stats.totalSaved} />
                    <MetricCard label="Unread" value={statusCounts.inbox} />
                    <MetricCard label="Done" value={stats.totalCompleted} />
                  </div>
                </div>

                <form onSubmit={handleFetchMetadata} className="mt-6 flex flex-col gap-3 lg:flex-row">
                  <label className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-library-muted" size={18} />
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="Paste a link to save"
                      className="h-14 w-full rounded-full border border-white/80 bg-white/76 pl-12 pr-4 text-sm text-library-ink shadow-[0_14px_32px_rgba(15,43,84,0.05)] outline-none backdrop-blur-xl transition focus:border-library-accent focus:ring-4 focus:ring-library-accent/10"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-library-accent px-6 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(37,99,235,0.24)] transition hover:bg-library-accent-strong disabled:opacity-60"
                  >
                    <Plus size={18} />
                    {loading ? "Fetching" : "Preview Link"}
                  </button>
                </form>

                {(error || notice) && (
                  <div
                    className={`mt-4 rounded-[22px] border px-4 py-3 text-sm backdrop-blur-xl ${
                      error
                        ? "border-blue-200 bg-white/90 text-blue-900"
                        : "border-blue-200 bg-blue-50/80 text-blue-900"
                    }`}
                  >
                    {error || notice}
                  </div>
                )}

                {previewMetadata ? (
                  <div className="mt-5 grid gap-4 rounded-[22px] border border-white/75 bg-white/62 p-4 shadow-[0_18px_50px_rgba(15,43,84,0.06)] backdrop-blur-2xl lg:grid-cols-[220px_minmax(0,1fr)] lg:p-5">
                    <div className="relative overflow-hidden rounded-[18px] border border-white/80 bg-library-soft">
                      <div className="aspect-[1/1]">
                        <PreviewImage metadata={previewMetadata} />
                      </div>
                      <div className="absolute left-4 top-4">
                        <PlatformBadge platform={previewMetadata.platform} />
                      </div>
                      <button
                        aria-label="Close preview"
                        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/70 backdrop-blur-xl"
                        onClick={() => setPreviewMetadata(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="space-y-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Preview</p>
                        <h3 className="line-clamp-2 text-[1.5rem] font-semibold leading-[1.02] tracking-tight text-library-ink sm:text-[1.8rem]">
                          {previewMetadata.title}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-6 text-library-muted">{previewMetadata.description}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">Category</span>
                          <input
                            list="category-options"
                            value={selectedCategory}
                            onChange={(event) => setSelectedCategory(event.target.value)}
                            placeholder="Choose or create a category"
                            className="h-12 w-full rounded-2xl border border-white/80 bg-white/76 px-4 text-sm outline-none backdrop-blur-xl focus:border-library-accent focus:ring-4 focus:ring-library-accent/10"
                          />
                          <datalist id="category-options">
                            {availableCategories.map((category) => (
                              <option key={category} value={category} />
                            ))}
                          </datalist>
                        </label>

                        <label className="space-y-2">
                          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">Intent</span>
                          <input
                            type="text"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Why keep this around?"
                            className="h-12 w-full rounded-2xl border border-white/80 bg-white/76 px-4 text-sm outline-none backdrop-blur-xl focus:border-library-accent focus:ring-4 focus:ring-library-accent/10"
                          />
                        </label>
                      </div>

                      <button
                        className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-library-accent px-5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(37,99,235,0.24)] transition hover:bg-library-accent-strong"
                        onClick={handleSave}
                      >
                        <Bookmark size={16} />
                        Save to This Browser
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/70 bg-white/60 p-4 shadow-[0_22px_70px_rgba(15,43,84,0.08)] backdrop-blur-2xl sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Library</p>
                  <h3 className="google-display mt-2 text-[2rem] leading-none tracking-tight">Saved references</h3>
                </div>

                <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row">
                  <label className="relative min-w-0 xl:w-[280px]">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-library-muted" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search titles, sources, notes"
                      className="h-11 w-full rounded-full border border-white/80 bg-white/75 pl-11 pr-4 text-sm outline-none backdrop-blur-xl focus:border-library-accent focus:ring-4 focus:ring-library-accent/10"
                    />
                  </label>

                  <div className="smooth-scroll-area flex gap-2 overflow-x-auto pb-1">
                    {STATUS_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
                          statusFilter === filter
                            ? "border-library-accent bg-library-accent text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]"
                            : "border-white/80 bg-white/72 text-library-ink backdrop-blur-xl"
                        }`}
                        onClick={() => setStatusFilter(filter)}
                      >
                        {filter === "inbox" ? <Inbox size={15} /> : <Archive size={15} />}
                        {filter === "inbox" ? "Inbox" : "Archive"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="smooth-scroll-area mt-4 flex gap-2 overflow-x-auto pb-1">
                {PLATFORM_FILTERS.map((platform) => {
                  const isAll = platform === "All";
                  const Icon = isAll ? Layers : PLATFORM_ICONS[platform];
                  const count = isAll ? savedItems.length : platformCounts[platform];

                  return (
                    <button
                      key={platform}
                      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition ${
                        platformFilter === platform
                          ? "border-library-accent bg-library-accent text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]"
                          : "border-white/80 bg-white/70 text-library-ink backdrop-blur-xl"
                      }`}
                      onClick={() => setPlatformFilter(platform)}
                    >
                      <Icon size={15} />
                      {platform}
                      <span className="font-mono text-[11px] opacity-75">{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5">
                {hydrating ? (
                  <CardSkeletonGrid />
                ) : filteredItems.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                    <AnimatePresence mode="popLayout">
                      {filteredItems.map((item) => (
                        <motion.div key={item.id} layout>
                          <ContentCard item={item} onDelete={deleteItem} onToggleRead={toggleRead} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="grid min-h-[280px] place-items-center rounded-[18px] border border-dashed border-library-line/80 bg-library-soft/52 p-8 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/78 shadow-[0_12px_30px_rgba(15,43,84,0.06)]">
                        <Inbox size={26} className="text-library-muted" />
                      </div>
                      <h3 className="font-serif text-[1.9rem] leading-none tracking-tight">Nothing matches this view.</h3>
                      <p className="mt-3 text-sm leading-6 text-library-muted">
                        Adjust the search, source, or status filters to bring items back into the grid.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showRandomModal && randomItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-library-ink/18 p-4 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="grid w-full max-w-4xl overflow-hidden rounded-[22px] border border-white/75 bg-white/74 shadow-[0_30px_90px_rgba(15,43,84,0.18)] backdrop-blur-2xl lg:grid-cols-[0.95fr_1fr]"
            >
              <div className="border-b border-white/70 bg-library-soft lg:border-b-0 lg:border-r">
                <div className="aspect-[4/5]">
                  {randomItem.image ? (
                    <img src={randomItem.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="grid h-full place-items-center font-serif text-2xl text-library-muted">No preview</div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-5 p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <PlatformBadge platform={randomItem.platform} />
                  <button
                    aria-label="Close selection"
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/72 backdrop-blur-xl"
                    onClick={() => setShowRandomModal(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Random pick</p>
                  <h3 className="mt-3 font-serif text-[2.4rem] leading-[0.96] tracking-tight">{randomItem.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-library-muted">
                    {randomItem.reason || "No note was saved for this reference."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoTile icon={HardDrive} title="Source" value={randomItem.source} />
                  <InfoTile
                    icon={Bookmark}
                    title="Saved on"
                    value={DATE_FORMATTER.format(randomItem.savedAt)}
                  />
                </div>

                <div className="mt-auto flex gap-3">
                  <a
                    href={randomItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-library-accent px-5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(37,99,235,0.24)]"
                    onClick={() => {
                      setShowRandomModal(false);
                      toggleRead(randomItem.id);
                    }}
                  >
                    Open link
                    <ExternalLink size={16} />
                  </a>
                  <button
                    className="grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-white/72 backdrop-blur-xl"
                    onClick={pickRandom}
                  >
                    <RefreshCcw size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarContent({
  expanded,
  platformCounts,
  stats,
  progressPercentage,
  statusCounts,
  statusFilter,
  setStatusFilter,
  platformFilter,
  setPlatformFilter,
  availableCategories,
  categoryFilter,
  setCategoryFilter,
  storageMode,
  onClose,
}: {
  expanded: boolean;
  platformCounts: Record<ContentPlatform, number>;
  stats: UserStats;
  progressPercentage: number;
  statusCounts: Record<StatusFilter, number>;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  platformFilter: "All" | ContentPlatform;
  setPlatformFilter: (value: "All" | ContentPlatform) => void;
  availableCategories: ContentCategory[];
  categoryFilter: "All" | ContentCategory;
  setCategoryFilter: (value: "All" | ContentCategory) => void;
  storageMode: StorageMode;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {onClose && (
        <div className="flex items-center justify-between px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">Navigation</span>
          <button
            aria-label="Close navigation"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white/72 backdrop-blur-xl"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className={`smooth-scroll-area flex-1 overflow-y-auto ${expanded ? "px-5" : "px-2"}`}>
        <section className="mb-6 rounded-[24px] border border-white/70 bg-library-soft/68 p-4">
          {expanded ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">Progress</p>
                  <p className="mt-2 font-serif text-[2.5rem] leading-none tracking-tight">{progressPercentage}%</p>
                </div>
                <CheckCircle2 size={22} className="text-library-accent" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/90">
                <motion.div className="h-full bg-library-accent" animate={{ width: `${progressPercentage}%` }} />
              </div>
            </>
          ) : (
            <div className="grid place-items-center">
              <CheckCircle2 size={20} className="text-library-accent" />
            </div>
          )}
        </section>

        <SidebarSection label="Status" expanded={expanded}>
          {STATUS_FILTERS.map((filter) => (
            <div key={filter}>
              <SidebarButton
                active={statusFilter === filter}
                expanded={expanded}
                icon={filter === "inbox" ? Inbox : Archive}
                label={filter === "inbox" ? "Inbox" : "Archive"}
                value={statusCounts[filter]}
                onClick={() => setStatusFilter(filter)}
              />
            </div>
          ))}
        </SidebarSection>

        <SidebarSection label="Source" expanded={expanded}>
          {PLATFORM_FILTERS.map((platform) => {
            const isAll = platform === "All";
            const Icon = isAll ? Layers : PLATFORM_ICONS[platform];
            const value = isAll ? stats.totalSaved : platformCounts[platform];

            return (
              <div key={platform}>
                <SidebarButton
                  active={platformFilter === platform}
                  expanded={expanded}
                  icon={Icon}
                  label={platform}
                  value={value}
                  onClick={() => setPlatformFilter(platform)}
                />
              </div>
            );
          })}
        </SidebarSection>

        <SidebarSection label="Collection" expanded={expanded}>
          <SidebarButton
            active={categoryFilter === "All"}
            expanded={expanded}
            icon={Layers}
            label="All"
            value={stats.totalSaved}
            onClick={() => setCategoryFilter("All")}
          />
          {availableCategories.map((category) => (
            <div key={category}>
              <SidebarButton
                active={categoryFilter === category}
                expanded={expanded}
                icon={getCategoryIcon(category)}
                label={category}
                value={stats.categoryBreakdown[category] || 0}
                onClick={() => setCategoryFilter(category)}
              />
            </div>
          ))}
        </SidebarSection>
      </div>

      <div className={`${expanded ? "px-5" : "px-2"} pt-3`}>
        <div className={`rounded-[24px] border border-white/70 bg-white/70 p-4 backdrop-blur-xl ${expanded ? "" : "grid place-items-center"}`}>
          {expanded ? (
            <>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-library-soft text-library-accent">
                  <HardDrive size={17} />
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">Storage</p>
                  <p className="text-sm font-medium text-library-ink">{STORAGE_LABELS[storageMode]}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-library-muted">
                Links and thumbnails are saved in this browser instead of living only in memory.
              </p>
            </>
          ) : (
            <HardDrive size={18} className="text-library-accent" />
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  label,
  expanded,
  children,
}: {
  label: string;
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      {expanded && <p className="mb-2 px-2 font-mono text-[11px] uppercase tracking-[0.22em] text-library-muted">{label}</p>}
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function SidebarButton({
  active,
  expanded,
  icon: Icon,
  label,
  value,
  onClick,
}: {
  active: boolean;
  expanded: boolean;
  icon: typeof Inbox;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center rounded-full border px-3 py-2 text-sm transition ${
        active
          ? "border-library-accent bg-library-accent text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]"
          : "border-white/60 bg-white/55 text-library-ink backdrop-blur-xl"
      } ${expanded ? "justify-between" : "justify-center"}`}
      onClick={onClick}
      title={expanded ? undefined : label}
    >
      <span className={`flex items-center gap-3 ${expanded ? "" : "justify-center"}`}>
        <Icon size={15} />
        {expanded && <span>{label}</span>}
      </span>
      {expanded && <span className="font-mono text-[11px] opacity-75">{value}</span>}
    </button>
  );
}

function StoragePill({ mode }: { mode: StorageMode }) {
  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/72 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted backdrop-blur-xl">
      <HardDrive size={14} />
      {STORAGE_LABELS[mode]}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-white/70 bg-white/74 p-4 shadow-[0_12px_30px_rgba(15,43,84,0.04)] backdrop-blur-xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">{label}</p>
      <p className="mt-2 font-serif text-[2rem] leading-none tracking-tight text-library-ink">{value}</p>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof HardDrive;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/70 bg-white/72 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-library-soft text-library-accent">
          <Icon size={16} />
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-library-muted">{title}</p>
          <p className="text-sm font-medium text-library-ink">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: ContentPlatform }) {
  const Icon = PLATFORM_ICONS[platform];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] shadow-sm backdrop-blur-xl ${PLATFORM_BADGE_STYLES[platform]}`}
    >
      <Icon size={13} />
      {platform}
    </span>
  );
}

function PreviewImage({ metadata }: { metadata: ContentMetadata }) {
  const image = metadata.imageData || metadata.image || metadata.thumbnail;

  return image ? (
    <img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
  ) : (
    <div className="grid h-full place-items-center font-serif text-2xl text-library-muted">No preview</div>
  );
}

function ContentCard({
  item,
  onToggleRead,
  onDelete,
}: {
  item: SavedContent;
  onToggleRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const CategoryIcon = getCategoryIcon(item.category);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14, scale: 0.98 }}
      className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-white/75 bg-white/68 shadow-[0_14px_36px_rgba(15,43,84,0.07)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(15,43,84,0.11)]"
    >
      <div className="relative aspect-[1/1] overflow-hidden bg-library-soft">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid h-full place-items-center font-serif text-xl text-library-muted">No preview</div>
        )}

        <div className="absolute left-2 top-2">
          <PlatformBadge platform={item.platform} />
        </div>

        <div className="absolute right-2 top-2 flex gap-1.5 opacity-100 transition sm:opacity-0 sm:hover:opacity-100 sm:group-hover:opacity-100">
          <button
            className="grid h-7 w-7 place-items-center rounded-full border border-white/75 bg-white/78 text-library-ink backdrop-blur-xl"
            onClick={() => onToggleRead(item.id)}
            title={item.isRead ? "Move back to inbox" : "Mark as completed"}
          >
            <CheckCircle2 size={14} />
          </button>
          <button
            className="grid h-7 w-7 place-items-center rounded-full border border-white/75 bg-white/78 text-blue-700 backdrop-blur-xl"
            onClick={() => onDelete(item.id)}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-[124px] flex-1 flex-col p-3">
        <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-library-muted">
          <CategoryIcon size={12} />
          <span>{item.category}</span>
          <span>{item.source}</span>
        </div>

        <h4 className="line-clamp-2 font-serif text-[1.02rem] leading-[1.05] tracking-tight text-library-ink">
          <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
            {item.title}
          </a>
        </h4>

        <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-library-muted">{item.description}</p>

        <div className="mt-auto pt-3">
          <p className="truncate text-xs italic text-library-muted">
            {item.reason || "No note added for this reference."}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-library-muted">
              {DATE_FORMATTER.format(item.savedAt)}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-library-accent"
            >
              Open
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CardSkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[18px] border border-white/70 bg-white/60 shadow-[0_14px_36px_rgba(15,43,84,0.05)]"
        >
          <div className="aspect-[1/1] animate-pulse bg-library-soft/80" />
          <div className="space-y-2.5 p-3">
            <div className="h-3 w-24 rounded-full bg-library-soft/80" />
            <div className="h-4 w-full rounded-full bg-library-soft/70" />
            <div className="h-4 w-4/5 rounded-full bg-library-soft/70" />
            <div className="h-4 w-2/3 rounded-full bg-library-soft/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
