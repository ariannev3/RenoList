import { useState, useEffect, useRef } from "react";
import { supabase, isConfigured } from "./supabaseClient";

/* ------------------------------------------------------------------ */
/*  Renovation board — tasks & materials per room, shared via Supabase */
/* ------------------------------------------------------------------ */

const BOARD_ID = "main"; // the single shared board everyone reads/writes
const uid = () => Math.random().toString(36).slice(2, 9);

// Soft pastel palettes, one per room. New rooms cycle through these.
const ROOM_COLORS = [
  { key: "lavender", dot: "#B79CEB", chip: "#E7DEFA", ring: "#C9B4F2", ink: "#4A3A72" },
  { key: "peach",    dot: "#F0A184", chip: "#FBE0D5", ring: "#F4B49E", ink: "#7A4230" },
  { key: "sky",      dot: "#89B4EF", chip: "#DEEAFB", ring: "#A9C7F3", ink: "#2F4E7C" },
  { key: "yellow",   dot: "#EFC85F", chip: "#FBEFC6", ring: "#F2D888", ink: "#7A5B12" },
  { key: "sage",     dot: "#94C285", chip: "#E1EEDB", ring: "#B4D6A8", ink: "#3C5E30" },
  { key: "pink",     dot: "#EE9BBC", chip: "#FADCE7", ring: "#F3B9CE", ink: "#7A314F" },
];
const colorAt = (i) => ROOM_COLORS[i % ROOM_COLORS.length];

const seed = () => [
  {
    id: uid(), name: "Kitchen", ci: 0,
    tasks: [
      { id: uid(), text: "Remove old cabinets", done: true },
      { id: uid(), text: "Install new countertop", done: false },
      { id: uid(), text: "Tile the backsplash", done: false },
      { id: uid(), text: "Paint the walls", done: false },
    ],
    materials: [
      { id: uid(), text: "Quartz countertop", amount: "3 m²", done: true },
      { id: uid(), text: "Cabinet handles", amount: "12", done: false },
      { id: uid(), text: "Backsplash tiles", amount: "4 m²", done: false },
      { id: uid(), text: "White wall paint", amount: "5 L", done: false },
    ],
  },
  {
    id: uid(), name: "Bathroom", ci: 2,
    tasks: [
      { id: uid(), text: "Replace floor tiles", done: false },
      { id: uid(), text: "Install new sink", done: false },
      { id: uid(), text: "Reseal the bathtub", done: true },
    ],
    materials: [
      { id: uid(), text: "Floor tiles", amount: "6 m²", done: false },
      { id: uid(), text: "Sink unit", amount: "1", done: false },
      { id: uid(), text: "Silicone sealant", amount: "2", done: true },
    ],
  },
  {
    id: uid(), name: "Living room", ci: 1,
    tasks: [
      { id: uid(), text: "Sand the floor", done: false },
      { id: uid(), text: "Paint the ceiling", done: false },
    ],
    materials: [
      { id: uid(), text: "Floor varnish", amount: "2.5 L", done: false },
      { id: uid(), text: "Ceiling paint", amount: "10 L", done: false },
    ],
  },
];

/* ---- Supabase persistence: the whole board is one JSON record ---- */
async function loadBoard() {
  const { data, error } = await supabase
    .from("board")
    .select("data")
    .eq("id", BOARD_ID)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}
async function saveBoard(rooms) {
  const { error } = await supabase
    .from("board")
    .upsert({ id: BOARD_ID, data: rooms, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ------------------------------ icons ------------------------------ */
const Icon = {
  check: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" {...p}>
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  x: (p) => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" {...p}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  pencil: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" {...p}>
      <path d="M4 20h4L18.5 9.5a2 2 0 000-2.8l-1.2-1.2a2 2 0 00-2.8 0L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  tasks: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path d="M4 6h10M4 12h10M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6l1.5 1.5L22 5M18 12l1.5 1.5L22 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cart: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path d="M3 4h2l2 12h11l2-8H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
    </svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" {...p}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------- checkbox -------------------------------- */
// A task that has subtasks is "complete" when all its subtasks are done;
// a task without subtasks just uses its own checkbox.
const taskComplete = (t) =>
  t.subtasks && t.subtasks.length ? t.subtasks.every((s) => s.done) : !!t.done;

function Check({ done, color, onClick, small, disabled }) {
  return (
    <button
      type="button"
      className={"box" + (done ? " on" : "") + (small ? " sub" : "") + (disabled ? " disabled" : "")}
      style={{ "--dot": color.dot, "--chip": color.chip }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={done}
      aria-label={done ? "Mark not done" : "Mark done"}
    >
      {done && <Icon.check />}
    </button>
  );
}

/* ----------------------------- task row ---------------------------- */
function TaskRow({ task, color, onToggle, onDelete, onAddSub, onToggleSub, onDeleteSub }) {
  const subs = task.subtasks || [];
  const hasSubs = subs.length > 0;
  const complete = taskComplete(task);

  // Expand/collapse. Default: expanded while open, collapsed once complete.
  // A manual toggle overrides that until the completion state changes.
  const [override, setOverride] = useState(null); // null = follow default
  const prevComplete = useRef(complete);
  useEffect(() => {
    if (prevComplete.current !== complete) {
      prevComplete.current = complete;
      setOverride(null); // snap back to default when a task opens/closes
    }
  }, [complete]);
  const expanded = override === null ? !complete : override;

  // Add-subtask input (one per row).
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);
  const submitSub = () => {
    const t = text.trim();
    if (t) onAddSub(task.id, t);
    setText("");
    setAdding(false);
  };

  return (
    <li className="task-wrap">
      <div className={"item" + (complete ? " done" : "")}>
        <Check done={complete} disabled={hasSubs} color={color} onClick={() => onToggle(task.id)} />
        <span className="item-text">{task.text}</span>
        {hasSubs && (
          <button
            className={"subtoggle" + (expanded ? " open" : "")}
            onClick={() => setOverride(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
          >
            {subs.filter((s) => s.done).length}/{subs.length}
            <Icon.chevron className="chev" />
          </button>
        )}
        <button className="del" onClick={() => onDelete(task.id)} aria-label="Delete">
          <Icon.x />
        </button>
      </div>

      {expanded && (
        <>
          {hasSubs && (
            <ul className="sublist">
              {subs.map((st) => (
                <li key={st.id} className={"subitem" + (st.done ? " done" : "")}>
                  <Check small done={st.done} color={color} onClick={() => onToggleSub(task.id, st.id)} />
                  <span className="item-text">{st.text}</span>
                  <button className="del" onClick={() => onDeleteSub(task.id, st.id)} aria-label="Delete subtask">
                    <Icon.x />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="sub-add">
              <span className="box sub" aria-hidden="true" />
              <input
                ref={inputRef}
                className="sub-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSub();
                  if (e.key === "Escape") { setAdding(false); setText(""); }
                }}
                onBlur={submitSub}
                placeholder="Add a subtask…"
              />
            </div>
          ) : (
            <button className="sub-add-btn" onClick={() => setAdding(true)}>
              <Icon.plus /> Subtask
            </button>
          )}
        </>
      )}
    </li>
  );
}

/* --------------------------- list column --------------------------- */
function ListColumn({
  kind, color, items, onAdd, onToggle, onDelete, onAmount,
  onAddSub, onToggleSub, onDeleteSub,
}) {
  const [val, setVal] = useState("");
  const [amt, setAmt] = useState("");
  const isTask = kind === "task";
  const hasAmount = kind === "material";
  const done = items.filter((i) => (isTask ? taskComplete(i) : i.done)).length;

  const submit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t, amt.trim());
    setVal("");
    setAmt("");
  };

  return (
    <section className="col">
      <div className="col-head">
        <div className="col-ic" style={{ background: color.chip, color: color.ink }}>
          {isTask ? <Icon.tasks /> : <Icon.cart />}
        </div>
        <span className="col-title">{isTask ? "Tasks" : "Materials"}</span>
        <span className="col-badge">{done}/{items.length} {isTask ? "done" : "bought"}</span>
      </div>

      <div className="add-row">
        <input
          className="add-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={isTask ? "Add a task…" : "Add a material…"}
        />
        {hasAmount && (
          <input
            className="add-input add-amt"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Amount"
          />
        )}
        <button className="add-btn" style={{ background: color.dot }} onClick={submit} aria-label="Add">
          <Icon.plus />
        </button>
      </div>

      {hasAmount && items.length > 0 && (
        <div className="list-head">
          <span>Material</span>
          <span className="lh-amt">Amount</span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="empty">
          {isTask ? "No tasks yet — add the first job for this room." : "Nothing on the shopping list yet."}
        </p>
      ) : (
        <ul className="list">
          {isTask
            ? [...items]
                .sort((a, b) => (taskComplete(a) ? 1 : 0) - (taskComplete(b) ? 1 : 0))
                .map((it) => (
                  <TaskRow
                    key={it.id}
                    task={it}
                    color={color}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onAddSub={onAddSub}
                    onToggleSub={onToggleSub}
                    onDeleteSub={onDeleteSub}
                  />
                ))
            : items.map((it) => (
                <li key={it.id} className={"item" + (it.done ? " done" : "")}>
                  <Check done={it.done} color={color} onClick={() => onToggle(it.id)} />
                  <span className="item-text">{it.text}</span>
                  {hasAmount && (
                    <span className="amt-cell">
                      <input
                        className="amt-input"
                        value={it.amount || ""}
                        onChange={(e) => onAmount(it.id, e.target.value)}
                        placeholder="—"
                        aria-label="Amount"
                      />
                    </span>
                  )}
                  <button className="del" onClick={() => onDelete(it.id)} aria-label="Delete">
                    <Icon.x />
                  </button>
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------- setup notice ---------------------------- */
function SetupNotice() {
  return (
    <div className="reno">
      <div className="setup">
        <h2>Almost there</h2>
        <p>
          This board needs its Supabase connection before it can save anything.
          Add your two keys to a file called <code>.env.local</code> (see the
          README), then restart the dev server.
        </p>
        <pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_KEY=sb_publishable_xxxxxxxx`}</pre>
      </div>
    </div>
  );
}

/* ------------------------------ app -------------------------------- */
export default function App() {
  const [rooms, setRooms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting | live | offline
  const [activeId, setActiveId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const addRef = useRef(null);

  const roomsRef = useRef([]);        // always-current rooms, for the realtime handler
  const applyingRemote = useRef(false); // true while applying a change that came FROM the server
  const saveTimer = useRef(null);

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  // Initial load + live subscription to changes from the other person.
  useEffect(() => {
    if (!isConfigured) return;
    let channel;
    (async () => {
      try {
        let data = await loadBoard();
        if (!data || !data.length) {
          data = seed();          // first ever run — plant the starter board
          await saveBoard(data);
        }
        applyingRemote.current = true;
        setRooms(data);
        setActiveId(data[0] ? data[0].id : null);
        setStatus("live");
      } catch (e) {
        console.error("Could not load board:", e);
        const data = seed();      // still usable in-memory if the DB is unreachable
        applyingRemote.current = true;
        setRooms(data);
        setActiveId(data[0] ? data[0].id : null);
        setStatus("offline");
      } finally {
        setLoaded(true);
      }

      channel = supabase
        .channel("board-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "board", filter: `id=eq.${BOARD_ID}` },
          (payload) => {
            const incoming = payload.new && payload.new.data;
            if (!incoming) return;
            // ignore the echo of our own save
            if (JSON.stringify(incoming) === JSON.stringify(roomsRef.current)) return;
            applyingRemote.current = true;
            setRooms(incoming);
            setActiveId((prev) =>
              incoming.some((r) => r.id === prev) ? prev : (incoming[0] ? incoming[0].id : null)
            );
          }
        )
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Save on change (debounced), but skip saves that were triggered by a remote update.
  useEffect(() => {
    if (!loaded || !isConfigured) return;
    if (applyingRemote.current) { applyingRemote.current = false; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await saveBoard(rooms); setStatus("live"); }
      catch (e) { console.error("Could not save board:", e); setStatus("offline"); }
    }, 500);
  }, [rooms, loaded]);

  useEffect(() => {
    if (adding && addRef.current) addRef.current.focus();
  }, [adding]);

  const active = rooms.find((r) => r.id === activeId) || null;

  const update = (roomId, fn) =>
    setRooms((rs) => rs.map((r) => (r.id === roomId ? fn(r) : r)));

  const addItem = (kind, text, amount = "") =>
    update(active.id, (r) => ({
      ...r,
      [kind]: [
        ...r[kind],
        { id: uid(), text, done: false, ...(kind === "materials" ? { amount } : {}) },
      ],
    }));
  const setAmount = (itemId, amount) =>
    update(active.id, (r) => ({
      ...r,
      materials: r.materials.map((i) => (i.id === itemId ? { ...i, amount } : i)),
    }));
  const toggleItem = (kind, itemId) =>
    update(active.id, (r) => ({
      ...r,
      [kind]: r[kind].map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
    }));
  const deleteItem = (kind, itemId) =>
    update(active.id, (r) => ({
      ...r,
      [kind]: r[kind].filter((i) => i.id !== itemId),
    }));

  // --- subtasks (tasks only) ---
  const addSubtask = (taskId, text) =>
    update(active.id, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...(t.subtasks || []), { id: uid(), text, done: false }] }
          : t
      ),
    }));
  const toggleSubtask = (taskId, subId) =>
    update(active.id, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      ),
    }));
  const deleteSubtask = (taskId, subId) =>
    update(active.id, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subId) }
          : t
      ),
    }));

  const createRoom = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    const room = { id: uid(), name, ci: rooms.length, tasks: [], materials: [] };
    setRooms((rs) => [...rs, room]);
    setActiveId(room.id);
    setNewName("");
    setAdding(false);
  };
  const renameRoom = () => {
    const name = editName.trim();
    if (name) update(editId, (r) => ({ ...r, name }));
    setEditId(null);
  };
  const deleteRoom = (id) => {
    setRooms((rs) => {
      const next = rs.filter((r) => r.id !== id);
      if (id === activeId) setActiveId(next[0] ? next[0].id : null);
      return next;
    });
  };

  const pct = (r) => {
    const flags = [...r.tasks.map(taskComplete), ...r.materials.map((m) => !!m.done)];
    if (!flags.length) return 0;
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  };
  const overall = () => {
    const flags = rooms.flatMap((r) => [...r.tasks.map(taskComplete), ...r.materials.map((m) => !!m.done)]);
    if (!flags.length) return 0;
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  };

  const STAT = {
    lav: { chip: "#E7DEFA", dot: "#B79CEB", ink: "#4A3A72" },
    peach: { chip: "#FBE0D5", dot: "#F0A184", ink: "#7A4230" },
    sky: { chip: "#DEEAFB", dot: "#89B4EF", ink: "#2F4E7C" },
  };

  const syncLabel =
    status === "live" ? "Live · shared board"
    : status === "offline" ? "Offline — not saving"
    : "Connecting…";

  if (!isConfigured) return <SetupNotice />;

  return (
    <div className="reno">
      {/* ---------------- sidebar ---------------- */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark" />
          <span className="brand-name">Renovate</span>
        </div>

        <div className="side-label">Rooms</div>

        {rooms.map((r, i) => {
          const c = colorAt(r.ci ?? i);
          const total = r.tasks.length + r.materials.length;
          const isActive = r.id === activeId;
          return (
            <div
              key={r.id}
              className={"room-btn" + (isActive ? " active" : "")}
              onClick={() => editId !== r.id && setActiveId(r.id)}
            >
              <span className="room-dot" style={{ background: c.dot }} />
              {editId === r.id ? (
                <input
                  autoFocus
                  className="name-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && renameRoom()}
                  onBlur={renameRoom}
                />
              ) : (
                <span className="room-name">{r.name}</span>
              )}
              {isActive && editId !== r.id ? (
                <span className="room-tools">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditId(r.id); setEditName(r.name); }}
                    aria-label="Rename room"
                  ><Icon.pencil /></button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRoom(r.id); }}
                    aria-label="Delete room"
                  ><Icon.x /></button>
                </span>
              ) : (
                editId !== r.id && <span className="room-count">{total}</span>
              )}
            </div>
          );
        })}

        {adding ? (
          <input
            ref={addRef}
            className="side-input"
            style={{ marginTop: 4 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createRoom();
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            onBlur={createRoom}
            placeholder="Room name…"
          />
        ) : (
          <button className="add-room" onClick={() => setAdding(true)}>
            <Icon.plus /> New room
          </button>
        )}

        <div className="side-foot">
          <div className="overall">
            <div className="overall-top">
              <span className="overall-lbl">Whole project</span>
              <span className="overall-pct">{overall()}%</span>
            </div>
            <div className="bar">
              <i style={{ width: overall() + "%", background: "linear-gradient(90deg,#EFC85F,#EE9BBC,#89B4EF)" }} />
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------- main ---------------- */}
      {!loaded ? (
        <main className="main loading"><div className="spinner" /></main>
      ) : !active ? (
        <main className="main">
          <div className="blank">
            <h2>No rooms yet</h2>
            <p>Add a room to start tracking its tasks and materials.</p>
            <button onClick={() => setAdding(true)}>Add your first room</button>
          </div>
        </main>
      ) : (
        <main className="main">
          {(() => {
            const c = colorAt(active.ci ?? 0);
            const tDone = active.tasks.filter(taskComplete).length;
            const mDone = active.materials.filter((i) => i.done).length;
            const p = pct(active);
            return (
              <>
                <div className="head">
                  <div>
                    <h1 className="title">{active.name}</h1>
                    <p className="subtitle">
                      {active.tasks.length} tasks · {active.materials.length} materials
                    </p>
                  </div>
                  <div className="head-right">
                    <span className={"sync sync-" + status}>
                      <i /> {syncLabel}
                    </span>
                    <div className="head-progress">
                      <div className="hp-row">
                        <span className="hp-pct" style={{ color: c.ink }}>{p}%</span>
                        <span className="hp-lbl">complete</span>
                      </div>
                      <div className="bar hp-bar" style={{ background: "rgba(38,35,29,.08)" }}>
                        <i style={{ width: p + "%", background: c.dot }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat" style={{ background: STAT.lav.chip, color: STAT.lav.ink }}>
                    <div className="stat-ic"><Icon.tasks /></div>
                    <div className="stat-lbl">Tasks done</div>
                    <div className="stat-num">{tDone}<span style={{ opacity: .5, fontSize: 20 }}> / {active.tasks.length}</span></div>
                    <div className="stat-sub">{active.tasks.length - tDone} still to do</div>
                  </div>
                  <div className="stat" style={{ background: STAT.peach.chip, color: STAT.peach.ink }}>
                    <div className="stat-ic"><Icon.cart /></div>
                    <div className="stat-lbl">Materials bought</div>
                    <div className="stat-num">{mDone}<span style={{ opacity: .5, fontSize: 20 }}> / {active.materials.length}</span></div>
                    <div className="stat-sub">{active.materials.length - mDone} left to buy</div>
                  </div>
                  <div className="stat" style={{ background: STAT.sky.chip, color: STAT.sky.ink }}>
                    <div className="stat-ic"><Icon.check /></div>
                    <div className="stat-lbl">Room progress</div>
                    <div className="stat-num">{p}%</div>
                    <div className="stat-sub">across tasks & materials</div>
                  </div>
                </div>

                <div className="cols">
                  <ListColumn
                    kind="task"
                    color={c}
                    items={active.tasks}
                    onAdd={(t) => addItem("tasks", t)}
                    onToggle={(id) => toggleItem("tasks", id)}
                    onDelete={(id) => deleteItem("tasks", id)}
                    onAddSub={addSubtask}
                    onToggleSub={toggleSubtask}
                    onDeleteSub={deleteSubtask}
                  />
                  <ListColumn
                    kind="material"
                    color={c}
                    items={active.materials}
                    onAdd={(t, a) => addItem("materials", t, a)}
                    onToggle={(id) => toggleItem("materials", id)}
                    onDelete={(id) => deleteItem("materials", id)}
                    onAmount={(id, a) => setAmount(id, a)}
                  />
                </div>
              </>
            );
          })()}
        </main>
      )}
    </div>
  );
}
