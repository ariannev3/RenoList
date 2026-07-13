import { useState, useEffect, useRef } from "react";
import { supabase, isConfigured } from "./supabaseClient";
import {
  DndContext, DragOverlay, closestCenter, pointerWithin, rectIntersection,
  MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

/* ------------------------------ i18n -------------------------------- */
const LANG_KEY = "reno-lang";
const TRANSLATIONS = {
  en: {
    dashboard: "Dashboard", settings: "Settings", rooms: "Rooms", newRoom: "New room",
    roomNamePlaceholder: "Room name…", wholeProject: "Whole project",
    overview: "Overview", wholeProjectTasks: "Whole project — tasks complete",
    roomsCount: (n) => `${n} room${n === 1 ? "" : "s"} · renovation progress`,
    tasksWord: "tasks", materialsWord: "materials", doneWord: "done", boughtWord: "bought",
    tasksColTitle: "Tasks", materialsColTitle: "Materials",
    addTaskPh: "Add a task…", addMaterialPh: "Add a material…", amount: "Amount", material: "Material",
    noTasksYet: "No tasks yet — add the first job for this room.",
    noMaterialsYet: "Nothing on the shopping list yet.",
    subtaskBtn: "Subtask", addSubtaskPh: "Add a subtask…",
    tasksDone: "Tasks done", stillToDo: (n) => `${n} still to do`,
    materialsBought: "Materials bought", leftToBuy: (n) => `${n} left to buy`,
    taskProgress: "Task progress", ofRoomsTasks: "of this room's tasks",
    noRoomsTitle: "No rooms yet", noRoomsBody: "Add a room to start tracking its tasks and materials.",
    addFirstRoom: "Add your first room",
    connecting: "Connecting…", live: "Live · shared board", offline: "Offline — not saving",
    settingsTitle: "Settings", settingsSubtitle: "Preferences for this device",
    languageLbl: "Language", languageSub: "Changes the text shown throughout the board on this device.",
    english: "English", dutch: "Nederlands",
    statusLbl: "Board status", statusSub: "Whether changes are syncing to the shared database.",
    planner: "Planner", plannerSub: "Drag your open tasks into when you want to do them.",
    bucketUnscheduled: "Unscheduled", bucketToday: "Today", bucketTomorrow: "Tomorrow", bucketNextWeek: "Next week",
    plannerEmptyPool: "All open tasks land here until you plan them.",
    plannerEmptyBucket: "Drag tasks here",
  },
  nl: {
    dashboard: "Dashboard", settings: "Instellingen", rooms: "Kamers", newRoom: "Nieuwe kamer",
    roomNamePlaceholder: "Kamernaam…", wholeProject: "Hele project",
    overview: "Overzicht", wholeProjectTasks: "Hele project — taken voltooid",
    roomsCount: (n) => `${n} kamer${n === 1 ? "" : "s"} · renovatievoortgang`,
    tasksWord: "taken", materialsWord: "materialen", doneWord: "klaar", boughtWord: "gekocht",
    tasksColTitle: "Taken", materialsColTitle: "Materialen",
    addTaskPh: "Taak toevoegen…", addMaterialPh: "Materiaal toevoegen…", amount: "Aantal", material: "Materiaal",
    noTasksYet: "Nog geen taken — voeg de eerste klus voor deze kamer toe.",
    noMaterialsYet: "Nog niets op het boodschappenlijstje.",
    subtaskBtn: "Subtaak", addSubtaskPh: "Subtaak toevoegen…",
    tasksDone: "Taken klaar", stillToDo: (n) => `${n} nog te doen`,
    materialsBought: "Materialen gekocht", leftToBuy: (n) => `${n} nog te kopen`,
    taskProgress: "Taakvoortgang", ofRoomsTasks: "van de taken in deze kamer",
    noRoomsTitle: "Nog geen kamers", noRoomsBody: "Voeg een kamer toe om taken en materialen bij te houden.",
    addFirstRoom: "Voeg je eerste kamer toe",
    connecting: "Verbinden…", live: "Live · gedeeld bord", offline: "Offline — wordt niet opgeslagen",
    settingsTitle: "Instellingen", settingsSubtitle: "Voorkeuren voor dit apparaat",
    languageLbl: "Taal", languageSub: "Wijzigt de tekst die op het bord wordt getoond op dit apparaat.",
    english: "English", dutch: "Nederlands",
    statusLbl: "Bordstatus", statusSub: "Of wijzigingen worden gesynchroniseerd met de gedeelde database.",
    planner: "Planning", plannerSub: "Sleep je openstaande taken naar wanneer je ze wilt doen.",
    bucketUnscheduled: "Nog niet gepland", bucketToday: "Vandaag", bucketTomorrow: "Morgen", bucketNextWeek: "Volgende week",
    plannerEmptyPool: "Alle openstaande taken komen hier terecht totdat je ze inplant.",
    plannerEmptyBucket: "Sleep taken hierheen",
  },
};

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
  home: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  settings: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.99l1.004.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a7.688 7.688 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
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
  caret: (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...p}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  grip: (p) => (
    <svg viewBox="0 0 24 24" width="14" height="14" {...p}>
      <circle cx="9" cy="5" r="1.5" fill="currentColor" />
      <circle cx="15" cy="5" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <circle cx="9" cy="19" r="1.5" fill="currentColor" />
      <circle cx="15" cy="19" r="1.5" fill="currentColor" />
    </svg>
  ),
};

/* ------------------------- checkbox -------------------------------- */
// A task is complete when its own checkbox is ticked (you sign it off yourself).
const taskComplete = (t) => !!t.done;

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

/* --------------------- click-to-edit text -------------------------- */
function EditableText({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    if (editing && ref.current) { ref.current.focus(); ref.current.select(); }
  }, [editing]);
  const start = () => { setText(value); setEditing(true); };
  const commit = () => {
    const t = text.trim();
    if (t && t !== value) onSave(t);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        ref={ref}
        className="edit-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
      />
    );
  }
  return (
    <span className={className} onClick={start} title="Click to edit">{value}</span>
  );
}

/* --------------------------- drag list ----------------------------- */
// Wraps a list so its items can be reordered by dragging their handle.
// Works with mouse and touch (long-press) and keyboard.
function DragList({ items, onReorder, children }) {
  const ids = items.map((i) => i.id);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
    }
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
const dragStyle = (transform, transition, isDragging) => ({
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.6 : 1,
  zIndex: isDragging ? 20 : undefined,
  position: isDragging ? "relative" : undefined,
});

/* ------------------------------ planner ------------------------------ */
const PLAN_BUCKETS = ["unscheduled", "today", "tomorrow", "nextWeek"];

// closestCenter alone compares the pointer to every card on the whole board,
// so it can "snap" toward a neighbouring column even while the pointer is
// still inside the current one. Requiring the pointer to literally be inside
// a droppable first keeps each column "sticky" while you're hovering it.
function plannerCollisionDetection(args) {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
}

// Flattens every open (not-done) task across every room into one list,
// each tagged with its room's colour/name, its subtasks, and its planner bucket.
function flattenOpenTasks(rooms) {
  const flat = [];
  rooms.forEach((r, ri) => {
    const color = colorAt(r.ci ?? ri);
    (r.tasks || []).forEach((t) => {
      if (taskComplete(t)) return;
      flat.push({
        id: `${r.id}::${t.id}`,
        roomId: r.id, taskId: t.id, roomName: r.name, color,
        text: t.text, subtasks: t.subtasks || [],
        bucket: t.plan || "unscheduled", order: t.planOrder ?? 0,
      });
    });
  });
  return flat;
}

function PlannerDropZone({ bucket }) {
  const { setNodeRef, isOver } = useDroppable({ id: "col:" + bucket });
  return <div ref={setNodeRef} className={"planner-dropzone" + (isOver ? " over" : "")} />;
}

function PlannerCard({ item, onToggle, onToggleSub }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const subs = item.subtasks || [];
  return (
    <div ref={setNodeRef} style={dragStyle(transform, transition, isDragging)} className="planner-card">
      <button className="grip" {...attributes} {...listeners} aria-label="Drag">
        <Icon.grip />
      </button>
      <div className="planner-card-main">
        <div className="planner-card-row">
          <Check done={false} color={item.color} onClick={() => onToggle(item.roomId, item.taskId)} />
          <div className="planner-card-body">
            <span className="planner-card-text">{item.text}</span>
            <span className="planner-card-room">
              <span className="planner-card-dot" style={{ background: item.color.dot }} />
              {item.roomName}
            </span>
          </div>
        </div>
        {subs.length > 0 && (
          <ul className="planner-sublist">
            {subs.map((s) => (
              <li key={s.id} className={"planner-subitem" + (s.done ? " done" : "")}>
                <Check small done={s.done} color={item.color} onClick={() => onToggleSub(item.roomId, item.taskId, s.id)} />
                <span className="planner-sub-text">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// A plain, non-interactive visual copy of a card used only inside DragOverlay.
// DragOverlay portals this to the document body and moves it with the pointer,
// so it stays visible and correctly positioned no matter which column it's
// dragged over — unlike the real card, which only shifts within its own list.
function PlannerCardPreview({ item }) {
  const subs = item.subtasks || [];
  return (
    <div className="planner-card planner-card-preview">
      <span className="grip" aria-hidden="true">
        <Icon.grip />
      </span>
      <div className="planner-card-main">
        <div className="planner-card-row">
          <span className="box" style={{ "--dot": item.color.dot, "--chip": item.color.chip }} />
          <div className="planner-card-body">
            <span className="planner-card-text">{item.text}</span>
            <span className="planner-card-room">
              <span className="planner-card-dot" style={{ background: item.color.dot }} />
              {item.roomName}
            </span>
          </div>
        </div>
        {subs.length > 0 && (
          <ul className="planner-sublist">
            {subs.map((s) => (
              <li key={s.id} className={"planner-subitem" + (s.done ? " done" : "")}>
                <span className="box sub" style={{ "--dot": item.color.dot, "--chip": item.color.chip }} />
                <span className="planner-sub-text">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// The unscheduled pool grouped by room, collapsed by default — click a room
// to reveal its open tasks (and drag them out to plan them).
function PlannerRoomGroup({ room, items, expanded, onToggleExpand, onToggleTask, onToggleSub }) {
  return (
    <div className="planner-room-group">
      <button type="button" className="planner-room-head" onClick={onToggleExpand}>
        <span className="planner-room-dot" style={{ background: room.color.dot }} />
        <span className="planner-room-name">{room.name}</span>
        <span className="planner-room-count">{items.length}</span>
        <Icon.caret className={"planner-room-caret" + (expanded ? " open" : "")} />
      </button>
      {expanded && (
        <div className="planner-room-tasks">
          {items.map((item) => (
            <PlannerCard key={item.id} item={item} onToggle={onToggleTask} onToggleSub={onToggleSub} />
          ))}
        </div>
      )}
    </div>
  );
}

function Planner({ rooms, tr, onToggleTask, onToggleSub, onMove }) {
  const flat = flattenOpenTasks(rooms);
  const byBucket = {};
  PLAN_BUCKETS.forEach((b) => {
    byBucket[b] = flat.filter((x) => x.bucket === b).sort((a, b2) => a.order - b2.order);
  });

  // Which rooms are expanded in the Unscheduled tray (collapsed by default).
  const [expandedRooms, setExpandedRooms] = useState(() => new Set());
  const toggleRoomExpanded = (roomId) =>
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      return next;
    });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Track which card is being dragged so we can render a floating preview of it
  // (DragOverlay) — without this, the card only nudges within its own column
  // and can appear to vanish while it's dragged over a different column.
  const [activeItem, setActiveItem] = useState(null);
  const handleStart = ({ active }) => {
    setActiveItem(flat.find((x) => x.id === active.id) || null);
  };
  const handleEnd = ({ active, over }) => {
    setActiveItem(null);
    if (!over || active.id === over.id) return;
    onMove(active.id, over.id);
  };
  const handleCancel = () => setActiveItem(null);

  const labels = {
    unscheduled: tr.bucketUnscheduled, today: tr.bucketToday,
    tomorrow: tr.bucketTomorrow, nextWeek: tr.bucketNextWeek,
  };

  // Group the unscheduled pool by room, preserving room order, skipping empty rooms.
  const unscheduledByRoom = rooms
    .map((r, ri) => ({
      room: { id: r.id, name: r.name, color: colorAt(r.ci ?? ri) },
      items: byBucket.unscheduled.filter((x) => x.roomId === r.id),
    }))
    .filter((g) => g.items.length > 0);

  const visibleUnscheduledIds = unscheduledByRoom
    .filter((g) => expandedRooms.has(g.room.id))
    .flatMap((g) => g.items.map((x) => x.id));

  return (
    <section className="planner">
      <div className="planner-head">
        <h2>{tr.planner}</h2>
        <p>{tr.plannerSub}</p>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={plannerCollisionDetection}
        onDragStart={handleStart}
        onDragEnd={handleEnd}
        onDragCancel={handleCancel}
      >
        <div className="planner-grid">
          {PLAN_BUCKETS.map((bucket) => {
            const isTray = bucket === "unscheduled";
            return (
              <div key={bucket} className={"planner-col" + (isTray ? " tray" : "")}>
                <div className="planner-col-head">
                  <span>{labels[bucket]}</span>
                  <span className="planner-count">{byBucket[bucket].length}</span>
                </div>

                {isTray ? (
                  <SortableContext items={visibleUnscheduledIds} strategy={verticalListSortingStrategy}>
                    <div className="planner-col-body">
                      {unscheduledByRoom.length === 0 && (
                        <p className="planner-empty">{tr.plannerEmptyPool}</p>
                      )}
                      {unscheduledByRoom.map((g) => (
                        <PlannerRoomGroup
                          key={g.room.id}
                          room={g.room}
                          items={g.items}
                          expanded={expandedRooms.has(g.room.id)}
                          onToggleExpand={() => toggleRoomExpanded(g.room.id)}
                          onToggleTask={onToggleTask}
                          onToggleSub={onToggleSub}
                        />
                      ))}
                      <PlannerDropZone bucket={bucket} />
                    </div>
                  </SortableContext>
                ) : (
                  <SortableContext items={byBucket[bucket].map((x) => x.id)} strategy={verticalListSortingStrategy}>
                    <div className="planner-col-body">
                      {byBucket[bucket].length === 0 && (
                        <p className="planner-empty">{tr.plannerEmptyBucket}</p>
                      )}
                      {byBucket[bucket].map((item) => (
                        <PlannerCard key={item.id} item={item} onToggle={onToggleTask} onToggleSub={onToggleSub} />
                      ))}
                      <PlannerDropZone bucket={bucket} />
                    </div>
                  </SortableContext>
                )}
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeItem ? <PlannerCardPreview item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

/* ----------------------------- subtask row ------------------------- */
function SubtaskRow({ sub, taskId, color, onToggle, onDelete, onRename }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  return (
    <li ref={setNodeRef} style={dragStyle(transform, transition, isDragging)}
        className={"subitem" + (sub.done ? " done" : "")}>
      <button className="grip grip-sm" {...attributes} {...listeners} aria-label="Drag to reorder">
        <Icon.grip />
      </button>
      <Check small done={sub.done} color={color} onClick={() => onToggle(taskId, sub.id)} />
      <EditableText className="item-text" value={sub.text} onSave={(t) => onRename(taskId, sub.id, t)} />
      <button className="del" onClick={() => onDelete(taskId, sub.id)} aria-label="Delete subtask">
        <Icon.x />
      </button>
    </li>
  );
}

/* ----------------------------- task row ---------------------------- */
function TaskRow({ task, color, tr, onToggle, onDelete, onRename, onAddSub, onToggleSub, onDeleteSub, onRenameSub, onReorderSub }) {
  const subs = task.subtasks || [];
  const hasSubs = subs.length > 0;
  const complete = taskComplete(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  // Expand/collapse. Default: expanded while open, collapsed once signed off.
  const [override, setOverride] = useState(null); // null = follow default
  const prevComplete = useRef(complete);
  useEffect(() => {
    if (prevComplete.current !== complete) {
      prevComplete.current = complete;
      setOverride(null);
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
    <li ref={setNodeRef} style={dragStyle(transform, transition, isDragging)} className="task-wrap">
      <div className={"item" + (complete ? " done" : "")}>
        <button className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">
          <Icon.grip />
        </button>
        <Check done={complete} color={color} onClick={() => onToggle(task.id)} />
        <div className="task-main">
          <EditableText className="item-text" value={task.text} onSave={(t) => onRename(task.id, t)} />
          {hasSubs && (
            <button
              className={"arrow" + (expanded ? " open" : "")}
              onClick={() => setOverride(!expanded)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
            >
              <Icon.caret />
            </button>
          )}
        </div>
        <button className="del" onClick={() => onDelete(task.id)} aria-label="Delete">
          <Icon.x />
        </button>
      </div>

      {expanded && (
        <>
          {hasSubs && (
            <DragList items={subs} onReorder={(newSubs) => onReorderSub(task.id, newSubs)}>
              <ul className="sublist">
                {subs.map((st) => (
                  <SubtaskRow
                    key={st.id}
                    sub={st}
                    taskId={task.id}
                    color={color}
                    onToggle={onToggleSub}
                    onDelete={onDeleteSub}
                    onRename={onRenameSub}
                  />
                ))}
              </ul>
            </DragList>
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
                placeholder={tr.addSubtaskPh}
              />
            </div>
          ) : (
            <button className="sub-add-btn" onClick={() => setAdding(true)}>
              <Icon.plus /> {tr.subtaskBtn}
            </button>
          )}
        </>
      )}
    </li>
  );
}

/* ---------------------------- material row ------------------------- */
function MaterialRow({ item, color, onToggle, onDelete, onRename, onAmount }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={dragStyle(transform, transition, isDragging)}
        className={"item" + (item.done ? " done" : "")}>
      <button className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">
        <Icon.grip />
      </button>
      <Check done={item.done} color={color} onClick={() => onToggle(item.id)} />
      <EditableText className="item-text" value={item.text} onSave={(t) => onRename(item.id, t)} />
      <span className="amt-cell">
        <input
          className="amt-input"
          value={item.amount || ""}
          onChange={(e) => onAmount(item.id, e.target.value)}
          placeholder="—"
          aria-label="Amount"
        />
      </span>
      <button className="del" onClick={() => onDelete(item.id)} aria-label="Delete">
        <Icon.x />
      </button>
    </li>
  );
}

/* ----------------------------- room row ---------------------------- */
function RoomRow({ room, ci, active, editing, editName, onSelect, onStartEdit, onEditChange, onEditCommit, onDelete, onPickColor, tasksDone, tasksTotal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: room.id });
  return (
    <div ref={setNodeRef} style={dragStyle(transform, transition, isDragging)}
         className={"room-btn" + (active ? " active" : "")}
         onClick={() => !editing && onSelect()}>
      <button className="grip room-grip" {...attributes} {...listeners}
              onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder">
        <Icon.grip />
      </button>
      <ColorPicker ci={ci} onPick={onPickColor} />
      {editing ? (
        <input autoFocus className="name-input" value={editName}
               onChange={(e) => onEditChange(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && onEditCommit()}
               onBlur={onEditCommit} />
      ) : (
        <span className="room-name">{room.name}</span>
      )}
      {active && !editing ? (
        <span className="room-tools">
          <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} aria-label="Rename room"><Icon.pencil /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Delete room"><Icon.x /></button>
        </span>
      ) : (!editing && (
        <span className="room-pill">{tasksDone}/{tasksTotal}</span>
      ))}
    </div>
  );
}

/* --------------------------- colour picker -------------------------- */
function ColorPicker({ ci, onPick, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const n = ROOM_COLORS.length;
  const idx = ((ci ?? 0) % n + n) % n;
  const current = ROOM_COLORS[idx];
  return (
    <span className="color-picker">
      <button
        type="button"
        className={"color-trigger" + (size === "lg" ? " lg" : "")}
        style={{ background: current.dot }}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label="Change room colour"
        aria-expanded={open}
      />
      {open && (
        <>
          <div className="color-pop-backdrop" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="color-pop" onClick={(e) => e.stopPropagation()}>
            {ROOM_COLORS.map((col, i) => (
              <button
                key={col.key}
                type="button"
                className="color-swatch"
                style={{ background: col.dot }}
                onClick={() => { onPick(i); setOpen(false); }}
                aria-label={col.key}
              >
                {i === idx && <Icon.check />}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

/* --------------------------- list column --------------------------- */
function ListColumn({
  kind, color, items, tr, onAdd, onToggle, onDelete, onAmount, onRename, onReorderList,
  onAddSub, onToggleSub, onDeleteSub, onRenameSub, onReorderSub,
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
        <span className="col-title">{isTask ? tr.tasksColTitle : tr.materialsColTitle}</span>
        <span className="col-badge">{done}/{items.length} {isTask ? tr.doneWord : tr.boughtWord}</span>
      </div>

      <div className="add-row">
        <input
          className="add-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={isTask ? tr.addTaskPh : tr.addMaterialPh}
        />
        {hasAmount && (
          <input
            className="add-input add-amt"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={tr.amount}
          />
        )}
        <button className="add-btn" style={{ background: color.dot }} onClick={submit} aria-label="Add">
          <Icon.plus />
        </button>
      </div>

      {hasAmount && items.length > 0 && (
        <div className="list-head">
          <span>{tr.material}</span>
          <span className="lh-amt">{tr.amount}</span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="empty">
          {isTask ? tr.noTasksYet : tr.noMaterialsYet}
        </p>
      ) : isTask ? (
        (() => {
          const ordered = [...items].sort((a, b) => (taskComplete(a) ? 1 : 0) - (taskComplete(b) ? 1 : 0));
          return (
            <DragList items={ordered} onReorder={onReorderList}>
              <ul className="list">
                {ordered.map((it) => (
                  <TaskRow
                    key={it.id}
                    task={it}
                    color={color}
                    tr={tr}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onRename={onRename}
                    onAddSub={onAddSub}
                    onToggleSub={onToggleSub}
                    onDeleteSub={onDeleteSub}
                    onRenameSub={onRenameSub}
                    onReorderSub={onReorderSub}
                  />
                ))}
              </ul>
            </DragList>
          );
        })()
      ) : (
        (() => {
          const ordered = [...items].sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
          return (
            <DragList items={ordered} onReorder={onReorderList}>
              <ul className="list">
                {ordered.map((it) => (
                  <MaterialRow
                    key={it.id}
                    item={it}
                    color={color}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onRename={onRename}
                    onAmount={onAmount}
                  />
                ))}
              </ul>
            </DragList>
          );
        })()
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

/* ------------------------------ home -------------------------------- */
function Home({ rooms, pct, overall, tr, onOpenRoom, onAddRoom, onToggleTask, onToggleSub, onMoveTask }) {
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1 className="title">{tr.overview}</h1>
          <p className="subtitle">{tr.roomsCount(rooms.length)}</p>
        </div>
      </div>

      <div className="home-overall">
        <div className="home-overall-top">
          <span className="home-overall-lbl">{tr.wholeProjectTasks}</span>
          <span className="home-overall-pct">{overall}%</span>
        </div>
        <div className="bar home-overall-bar">
          <i style={{ width: overall + "%", background: "linear-gradient(90deg,#EFC85F,#EE9BBC,#89B4EF)" }} />
        </div>
      </div>

      <div className="room-grid">
        {rooms.map((r, i) => {
          const c = colorAt(r.ci ?? i);
          const p = pct(r);
          const tDone = r.tasks.filter(taskComplete).length;
          const mDone = r.materials.filter((m) => m.done).length;
          return (
            <button
              key={r.id}
              className="room-card"
              style={{ background: c.chip, color: c.ink }}
              onClick={() => onOpenRoom(r.id)}
            >
              <div className="room-card-top">
                <span className="room-card-name">{r.name}</span>
                <span className="room-card-pct">{p}%</span>
              </div>
              <div className="bar room-card-bar">
                <i style={{ width: p + "%", background: c.dot }} />
              </div>
              <div className="room-card-meta">
                <span>{tDone}/{r.tasks.length} {tr.tasksWord}</span>
                <span>{mDone}/{r.materials.length} {tr.materialsWord}</span>
              </div>
            </button>
          );
        })}

        <button className="room-card room-card-add" onClick={onAddRoom}>
          <Icon.plus />
          <span>{tr.newRoom}</span>
        </button>
      </div>

      <Planner rooms={rooms} tr={tr} onToggleTask={onToggleTask} onToggleSub={onToggleSub} onMove={onMoveTask} />
    </main>
  );
}

/* ---------------------------- settings ------------------------------ */
function Settings({ tr, lang, onSetLang, status, syncLabel }) {
  return (
    <main className="main">
      <div className="head">
        <div>
          <h1 className="title">{tr.settingsTitle}</h1>
          <p className="subtitle">{tr.settingsSubtitle}</p>
        </div>
      </div>

      <div className="settings-list">
        <section className="settings-card">
          <div className="settings-card-head">
            <h2>{tr.languageLbl}</h2>
            <p>{tr.languageSub}</p>
          </div>
          <div className="lang-options">
            <button
              type="button"
              className={"lang-opt" + (lang === "en" ? " active" : "")}
              onClick={() => onSetLang("en")}
            >
              {tr.english}
            </button>
            <button
              type="button"
              className={"lang-opt" + (lang === "nl" ? " active" : "")}
              onClick={() => onSetLang("nl")}
            >
              {tr.dutch}
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head">
            <h2>{tr.statusLbl}</h2>
            <p>{tr.statusSub}</p>
          </div>
          <span className={"sync sync-" + status}>
            <i /> {syncLabel}
          </span>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------ app -------------------------------- */
export default function App() {
  const [rooms, setRooms] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("connecting"); // connecting | live | offline
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("home"); // "home" | "room" | "settings"
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch { return "en"; }
  });
  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);
  const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;
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
  const renameItem = (kind, itemId, text) =>
    update(active.id, (r) => ({
      ...r,
      [kind]: r[kind].map((i) => (i.id === itemId ? { ...i, text } : i)),
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
  const renameSubtask = (taskId, subId, text) =>
    update(active.id, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).map((s) => (s.id === subId ? { ...s, text } : s)) }
          : t
      ),
    }));

  // --- drag reordering ---
  const reorderTasks = (newTasks) => update(active.id, (r) => ({ ...r, tasks: newTasks }));
  const reorderMaterials = (newMaterials) => update(active.id, (r) => ({ ...r, materials: newMaterials }));
  const reorderSubtasks = (taskId, newSubs) =>
    update(active.id, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: newSubs } : t)),
    }));
  const reorderRooms = (newRooms) => setRooms(newRooms);

  // --- planner (cross-room) ---
  // Toggle a task's done state by room id, not just the currently open room.
  const togglePlannerTask = (roomId, taskId) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }));
  const togglePlannerSubtask = (roomId, taskId, subId) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
          : t
      ),
    }));

  // Move/reorder a task between planner buckets (or within one). activeId/overId
  // are composite "roomId::taskId" strings, or overId can be "col:<bucket>" when
  // dropping into an empty (or trailing) part of a column.
  const movePlannerTask = (activeId, overId) => {
    const flat = flattenOpenTasks(rooms);
    const activeItem = flat.find((x) => x.id === activeId);
    if (!activeItem) return;

    let bucket, destExcludingActive, insertAt;
    if (overId.startsWith("col:")) {
      bucket = overId.slice(4);
      destExcludingActive = flat.filter((x) => x.bucket === bucket && x.id !== activeId);
      insertAt = destExcludingActive.length; // append at end
    } else {
      const overItem = flat.find((x) => x.id === overId);
      if (!overItem) return;
      bucket = overItem.bucket;
      destExcludingActive = flat.filter((x) => x.bucket === bucket && x.id !== activeId);
      insertAt = destExcludingActive.findIndex((x) => x.id === overId);
      if (insertAt === -1) insertAt = destExcludingActive.length;
    }

    const newOrder = [...destExcludingActive];
    newOrder.splice(insertAt, 0, activeItem);
    const planValue = bucket === "unscheduled" ? null : bucket;

    setRooms((rs) => rs.map((r) => ({
      ...r,
      tasks: r.tasks.map((t) => {
        const idx = newOrder.findIndex((x) => x.roomId === r.id && x.taskId === t.id);
        if (idx === -1) return t;
        return { ...t, plan: planValue, planOrder: idx };
      }),
    })));
  };

  const createRoom = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    const room = { id: uid(), name, ci: rooms.length, tasks: [], materials: [] };
    setRooms((rs) => [...rs, room]);
    setActiveId(room.id);
    setView("room");
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
  const setRoomColor = (id, ci) => update(id, (r) => ({ ...r, ci }));

  const pct = (r) => {
    if (!r.tasks.length) return 0;
    return Math.round((r.tasks.filter(taskComplete).length / r.tasks.length) * 100);
  };
  const overall = () => {
    const tasks = rooms.flatMap((r) => r.tasks);
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(taskComplete).length / tasks.length) * 100);
  };

  const STAT = {
    lav: { chip: "#E7DEFA", dot: "#B79CEB", ink: "#4A3A72" },
    peach: { chip: "#FBE0D5", dot: "#F0A184", ink: "#7A4230" },
    sky: { chip: "#DEEAFB", dot: "#89B4EF", ink: "#2F4E7C" },
  };

  const syncLabel =
    status === "live" ? tr.live
    : status === "offline" ? tr.offline
    : tr.connecting;

  if (!isConfigured) return <SetupNotice />;

  return (
    <div className="reno">
      {/* ---------------- sidebar ---------------- */}
      <aside className="side">
        <div className="brand">
          <div className="brand-mark" />
          <span className="brand-name">Renovate</span>
        </div>

        <button
          className={"home-btn" + (view === "home" ? " active" : "")}
          onClick={() => setView("home")}
        >
          <Icon.home /> {tr.dashboard}
        </button>

        <div className="side-label">{tr.rooms}</div>

        <DragList items={rooms} onReorder={reorderRooms}>
          {rooms.map((r, i) => (
            <RoomRow
              key={r.id}
              room={r}
              ci={r.ci ?? i}
              tasksDone={r.tasks.filter(taskComplete).length}
              tasksTotal={r.tasks.length}
              active={view === "room" && r.id === activeId}
              editing={editId === r.id}
              editName={editName}
              onSelect={() => { setActiveId(r.id); setView("room"); }}
              onStartEdit={() => { setEditId(r.id); setEditName(r.name); }}
              onEditChange={(v) => setEditName(v)}
              onEditCommit={renameRoom}
              onDelete={() => deleteRoom(r.id)}
              onPickColor={(idx) => setRoomColor(r.id, idx)}
            />
          ))}
        </DragList>

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
            placeholder={tr.roomNamePlaceholder}
          />
        ) : (
          <button className="add-room" onClick={() => setAdding(true)}>
            <Icon.plus /> {tr.newRoom}
          </button>
        )}

        <div className="side-foot">
          <div className="overall">
            <div className="overall-top">
              <span className="overall-lbl">{tr.wholeProject}</span>
              <span className="overall-pct">{overall()}%</span>
            </div>
            <div className="bar">
              <i style={{ width: overall() + "%", background: "linear-gradient(90deg,#EFC85F,#EE9BBC,#89B4EF)" }} />
            </div>
          </div>

          <button
            className={"settings-btn" + (view === "settings" ? " active" : "")}
            onClick={() => setView("settings")}
          >
            <Icon.settings /> {tr.settings}
          </button>
        </div>
      </aside>

      {/* ---------------- main ---------------- */}
      {!loaded ? (
        <main className="main loading"><div className="spinner" /></main>
      ) : view === "settings" ? (
        <Settings tr={tr} lang={lang} onSetLang={setLang} status={status} syncLabel={syncLabel} />
      ) : rooms.length === 0 ? (
        <main className="main">
          <div className="blank">
            <h2>{tr.noRoomsTitle}</h2>
            <p>{tr.noRoomsBody}</p>
            <button onClick={() => setAdding(true)}>{tr.addFirstRoom}</button>
          </div>
        </main>
      ) : view === "home" ? (
        <Home
          rooms={rooms}
          pct={pct}
          overall={overall()}
          tr={tr}
          onOpenRoom={(id) => { setActiveId(id); setView("room"); }}
          onAddRoom={() => setAdding(true)}
          onToggleTask={togglePlannerTask}
          onToggleSub={togglePlannerSubtask}
          onMoveTask={movePlannerTask}
        />
      ) : !active ? (
        <main className="main loading"><div className="spinner" /></main>
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
                  <div className="head-title">
                    <ColorPicker ci={active.ci ?? 0} size="lg" onPick={(idx) => setRoomColor(active.id, idx)} />
                    <div>
                      <h1 className="title">{active.name}</h1>
                      <p className="subtitle">
                        {active.tasks.length} {tr.tasksWord} · {active.materials.length} {tr.materialsWord}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat" style={{ background: STAT.lav.chip, color: STAT.lav.ink }}>
                    <div className="stat-ic"><Icon.tasks /></div>
                    <div className="stat-lbl">{tr.tasksDone}</div>
                    <div className="stat-num">{tDone}<span style={{ opacity: .5, fontSize: 20 }}> / {active.tasks.length}</span></div>
                    <div className="stat-sub">{tr.stillToDo(active.tasks.length - tDone)}</div>
                  </div>
                  <div className="stat" style={{ background: STAT.peach.chip, color: STAT.peach.ink }}>
                    <div className="stat-ic"><Icon.cart /></div>
                    <div className="stat-lbl">{tr.materialsBought}</div>
                    <div className="stat-num">{mDone}<span style={{ opacity: .5, fontSize: 20 }}> / {active.materials.length}</span></div>
                    <div className="stat-sub">{tr.leftToBuy(active.materials.length - mDone)}</div>
                  </div>
                  <div className="stat" style={{ background: STAT.sky.chip, color: STAT.sky.ink }}>
                    <div className="stat-ic"><Icon.check /></div>
                    <div className="stat-lbl">{tr.taskProgress}</div>
                    <div className="stat-num">{p}%</div>
                    <div className="stat-sub">{tr.ofRoomsTasks}</div>
                  </div>
                </div>

                <div className="cols">
                  <ListColumn
                    kind="task"
                    color={c}
                    tr={tr}
                    items={active.tasks}
                    onAdd={(t) => addItem("tasks", t)}
                    onToggle={(id) => toggleItem("tasks", id)}
                    onDelete={(id) => deleteItem("tasks", id)}
                    onRename={(id, t) => renameItem("tasks", id, t)}
                    onReorderList={reorderTasks}
                    onAddSub={addSubtask}
                    onToggleSub={toggleSubtask}
                    onDeleteSub={deleteSubtask}
                    onRenameSub={renameSubtask}
                    onReorderSub={reorderSubtasks}
                  />
                  <ListColumn
                    kind="material"
                    color={c}
                    tr={tr}
                    items={active.materials}
                    onAdd={(t, a) => addItem("materials", t, a)}
                    onToggle={(id) => toggleItem("materials", id)}
                    onDelete={(id) => deleteItem("materials", id)}
                    onRename={(id, t) => renameItem("materials", id, t)}
                    onReorderList={reorderMaterials}
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
