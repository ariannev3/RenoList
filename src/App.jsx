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
const NAME_KEY = "reno-commenter-name";
const SIDEBAR_KEY = "reno-sidebar-width";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 280;
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
    statusInProgress: "In progress", statusOnHold: "On hold", statusDone: "Done",
    subtasksComplete: "Subtasks complete", commentsLbl: "Comments",
    addCommentPh: "Add a comment…", noComments: "No comments yet.",
    yourNameLbl: "Your name", yourNameSub: "Shown on comments you leave on tasks.",
    yourNamePh: "e.g. Alex", defaultCommenter: "You", subtasksLbl: "Subtasks",
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
    statusInProgress: "Bezig", statusOnHold: "Gepauzeerd", statusDone: "Klaar",
    subtasksComplete: "Subtaken voltooid", commentsLbl: "Reacties",
    addCommentPh: "Voeg een reactie toe…", noComments: "Nog geen reacties.",
    yourNameLbl: "Jouw naam", yourNameSub: "Zichtbaar bij reacties die je op taken achterlaat.",
    yourNamePh: "bijv. Alex", defaultCommenter: "Jij", subtasksLbl: "Subtaken",
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
  brandMark: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}>
      <path d="M12 3.3l8.5 6.9a1 1 0 01.37.78V19.5a1.2 1.2 0 01-1.2 1.2H15v-6.2a1 1 0 00-1-1h-4a1 1 0 00-1 1v6.2H4.33a1.2 1.2 0 01-1.2-1.2v-8.52a1 1 0 01.37-.78L12 3.3z" />
    </svg>
  ),
  home: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  rooms: (p) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
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
  send: (p) => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  comment: (p) => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" {...p}>
      <path d="M4 5.5h16v10H9.5L5 19.5v-4H4v-10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
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
    <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
      <circle cx="9" cy="5" r="2" fill="currentColor" />
      <circle cx="15" cy="5" r="2" fill="currentColor" />
      <circle cx="9" cy="12" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="9" cy="19" r="2" fill="currentColor" />
      <circle cx="15" cy="19" r="2" fill="currentColor" />
    </svg>
  ),
};

/* ------------------------- checkbox -------------------------------- */
// A task is complete when its own checkbox is ticked (you sign it off yourself).
const taskComplete = (t) => !!t.done;

// Reuses the app's existing pastel palette (sky, yellow, sage) so status
// colours stay consistent with everything else rather than introducing new hues.
const STATUS_COLORS = {
  in_progress: { chip: "#DEEAFB", dot: "#89B4EF", ink: "#2F4E7C" },
  on_hold: { chip: "#FBEFC6", dot: "#EFC85F", ink: "#7A5B12" },
  done: { chip: "#E1EEDB", dot: "#94C285", ink: "#3C5E30" },
};
const taskStatusKey = (t) => (t.done ? "done" : t.status === "on_hold" ? "on_hold" : "in_progress");

function StatusPill({ statusKey, tr }) {
  const c = STATUS_COLORS[statusKey];
  const label = statusKey === "done" ? tr.statusDone : statusKey === "on_hold" ? tr.statusOnHold : tr.statusInProgress;
  return (
    <span className="status-pill" style={{ background: c.chip, color: c.ink, borderColor: c.dot }}>
      {label}
    </span>
  );
}

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

// Shared by task cards in a room's list and in the planner: a subtask-count
// pill, a comment-count pill, and a completion bar. Always shown (even at 0)
// so every card has the same shape and is quick to scan.
function TaskCardMeta({ subsTotal, commentsTotal }) {
  return (
    <div className="task-meta">
      <span className="meta-pill">
        <Icon.tasks width={12} height={12} aria-hidden="true" />
        {subsTotal}
      </span>
      <span className="meta-pill">
        <Icon.comment aria-hidden="true" />
        {commentsTotal}
      </span>
    </div>
  );
}
function TaskCardBar({ subsDone, subsTotal, color }) {
  const pct = subsTotal > 0 ? Math.round((subsDone / subsTotal) * 100) : 0;
  return (
    <div className="bar task-card-bar">
      <i style={{ width: pct + "%", background: color.dot }} />
    </div>
  );
}

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
        text: t.text, subtasks: t.subtasks || [], comments: t.comments || [], status: t.status,
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

function PlannerCard({ item, tr, onToggle, onOpenDetail }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const subs = item.subtasks || [];
  const subsDone = subs.filter((s) => s.done).length;
  return (
    <div
      ref={setNodeRef}
      style={dragStyle(transform, transition, isDragging)}
      className="planner-card"
    >
      <button className="grip" {...attributes} {...listeners} aria-label="Drag">
        <Icon.grip />
      </button>
      <div className="planner-card-main">
        <div className="planner-card-row">
          <Check done={false} color={item.color} onClick={() => onToggle(item.roomId, item.taskId)} />
          <div className="planner-card-body">
            <button
              type="button"
              className="planner-card-text task-title-btn"
              onClick={() => onOpenDetail(item.roomId, item.taskId)}
            >
              {item.text}
            </button>
            <StatusPill statusKey={taskStatusKey({ done: false, status: item.status })} tr={tr} />
            <span className="planner-card-room">
              <span className="planner-card-dot" style={{ background: item.color.dot }} />
              {item.roomName}
            </span>
          </div>
        </div>
        <TaskCardMeta subsTotal={subs.length} commentsTotal={(item.comments || []).length} />
        <TaskCardBar subsDone={subsDone} subsTotal={subs.length} color={item.color} />
      </div>
    </div>
  );
}

// A plain, non-interactive visual copy of a card used only inside DragOverlay.
// DragOverlay portals this to the document body and moves it with the pointer,
// so it stays visible and correctly positioned no matter which column it's
// dragged over — unlike the real card, which only shifts within its own list.
function PlannerCardPreview({ item, tr }) {
  const subs = item.subtasks || [];
  const subsDone = subs.filter((s) => s.done).length;
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
            <StatusPill statusKey={taskStatusKey({ done: false, status: item.status })} tr={tr} />
            <span className="planner-card-room">
              <span className="planner-card-dot" style={{ background: item.color.dot }} />
              {item.roomName}
            </span>
          </div>
        </div>
        <TaskCardMeta subsTotal={subs.length} commentsTotal={(item.comments || []).length} />
        <TaskCardBar subsDone={subsDone} subsTotal={subs.length} color={item.color} />
      </div>
    </div>
  );
}

// The unscheduled pool grouped by room, collapsed by default — click a room
// to reveal its open tasks (and drag them out to plan them).
function PlannerRoomGroup({ room, items, tr, expanded, onToggleExpand, onToggleTask, onOpenDetail }) {
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
            <PlannerCard key={item.id} item={item} tr={tr} onToggle={onToggleTask} onOpenDetail={onOpenDetail} />
          ))}
        </div>
      )}
    </div>
  );
}

function Planner({ rooms, tr, onToggleTask, onOpenDetail, onMove }) {
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
                          tr={tr}
                          expanded={expandedRooms.has(g.room.id)}
                          onToggleExpand={() => toggleRoomExpanded(g.room.id)}
                          onToggleTask={onToggleTask}
                          onOpenDetail={onOpenDetail}
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
                        <PlannerCard key={item.id} item={item} tr={tr} onToggle={onToggleTask} onOpenDetail={onOpenDetail} />
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
          {activeItem ? <PlannerCardPreview item={activeItem} tr={tr} /> : null}
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
function TaskRow({ task, color, tr, onToggle, onDelete, onOpenDetail }) {
  const subs = task.subtasks || [];
  const subsDone = subs.filter((s) => s.done).length;
  const commentsTotal = (task.comments || []).length;
  const complete = taskComplete(task);
  const statusKey = taskStatusKey(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <li ref={setNodeRef} style={dragStyle(transform, transition, isDragging)} className="task-wrap">
      <div className={"task-card" + (complete ? " done" : "")}>
        <div className="task-card-top">
          <button className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">
            <Icon.grip />
          </button>
          <Check done={complete} color={color} onClick={() => onToggle(task.id)} />
          <div className="task-main">
            <button type="button" className="item-text task-title-btn" onClick={() => onOpenDetail(task.id)}>
              {task.text}
            </button>
            <StatusPill statusKey={statusKey} tr={tr} />
          </div>
          <button className="del" onClick={() => onDelete(task.id)} aria-label="Delete">
            <Icon.x />
          </button>
        </div>
        <TaskCardMeta subsTotal={subs.length} commentsTotal={commentsTotal} />
        <TaskCardBar subsDone={subsDone} subsTotal={subs.length} color={color} />
      </div>
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
  kind, color, items, tr, onAdd, onToggle, onDelete, onAmount, onRename, onReorderList, onOpenDetail,
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
              <ul className="list task-list">
                {ordered.map((it) => (
                  <TaskRow
                    key={it.id}
                    task={it}
                    color={color}
                    tr={tr}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onOpenDetail={onOpenDetail}
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
function Home({ rooms, pct, overall, tr, onOpenRoom, onAddRoom, onToggleTask, onOpenDetail, onMoveTask }) {
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

      <Planner rooms={rooms} tr={tr} onToggleTask={onToggleTask} onOpenDetail={onOpenDetail} onMove={onMoveTask} />
    </main>
  );
}

/* ---------------------------- settings ------------------------------ */
function Settings({ tr, lang, onSetLang, status, syncLabel, commenterName, onSetCommenterName }) {
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
            <h2>{tr.yourNameLbl}</h2>
            <p>{tr.yourNameSub}</p>
          </div>
          <input
            className="settings-input"
            value={commenterName}
            onChange={(e) => onSetCommenterName(e.target.value)}
            placeholder={tr.yourNamePh}
          />
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

/* ------------------------- task detail popup ------------------------ */
function timeAgo(ts, tr) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return tr === "nl" ? "zojuist" : "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function TaskDetailModal({
  task, room, color, tr, onClose, onRename, onSetStatus,
  onAddSub, onToggleSub, onDeleteSub, onRenameSub, onReorderSub, onAddComment,
}) {
  const subs = task.subtasks || [];
  const comments = task.comments || [];
  const displayStatus = task.done ? "done" : (task.status === "on_hold" ? "on_hold" : "in_progress");

  const [subText, setSubText] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitSub = () => {
    const t = subText.trim();
    if (t) onAddSub(task.id, t);
    setSubText("");
  };
  const submitComment = () => {
    const t = commentText.trim();
    if (t) onAddComment(task.id, t);
    setCommentText("");
  };

  const subsDone = subs.filter((s) => s.done).length;

  return (
    <div className="reno detail-overlay" onClick={onClose}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <div>
            <div className="detail-room">
              <span className="detail-room-dot" style={{ background: color.dot }} />
              {room.name}
            </div>
            <EditableText className="detail-title" value={task.text} onSave={(t) => onRename(task.id, t)} />
          </div>
          <button className="detail-close" onClick={onClose} aria-label="Close">
            <Icon.x />
          </button>
        </div>

        <div className="detail-body">
          <div className="status-segmented">
            {[
              ["in_progress", tr.statusInProgress],
              ["on_hold", tr.statusOnHold],
              ["done", tr.statusDone],
            ].map(([key, label]) => {
              const c = STATUS_COLORS[key];
              const isActive = displayStatus === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={"status-opt" + (isActive ? " active" : "")}
                  style={isActive
                    ? { background: c.chip, color: c.ink, borderColor: c.dot }
                    : { background: "#fff", color: "var(--muted)", borderColor: "transparent" }}
                  onClick={() => onSetStatus(task.id, key)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {subs.length > 0 && (
            <div className="detail-progress">
              <div className="detail-progress-top">
                <span>{tr.subtasksComplete}</span>
                <span className="detail-progress-num">{subsDone}/{subs.length}</span>
              </div>
              <div className="bar detail-progress-bar">
                <i style={{ width: (subsDone / subs.length) * 100 + "%", background: color.dot }} />
              </div>
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-lbl">{tr.subtasksLbl}</div>
            {subs.length > 0 && (
              <DragList items={subs} onReorder={(newSubs) => onReorderSub(task.id, newSubs)}>
                <ul className="sublist detail-sublist">
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
            <div className="sub-add detail-sub-add">
              <span className="box sub" aria-hidden="true" />
              <input
                className="sub-input"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitSub()}
                placeholder={tr.addSubtaskPh}
              />
              <button className="detail-sub-add-btn" onClick={submitSub} aria-label="Add subtask">
                <Icon.plus />
              </button>
            </div>
          </div>

          <div className="detail-section detail-comments">
            <div className="detail-section-lbl">{tr.commentsLbl}</div>
            {comments.length === 0 ? (
              <p className="detail-no-comments">{tr.noComments}</p>
            ) : (
              <div className="comment-list">
                {comments.map((c) => (
                  <div className="comment" key={c.id}>
                    <span className="comment-avatar" style={{ background: color.chip, color: color.ink }}>
                      {(c.author || "?").trim().slice(0, 1).toUpperCase()}
                    </span>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-author">{c.author}</span>
                        <span className="comment-time">{timeAgo(c.ts, tr === TRANSLATIONS.nl ? "nl" : "en")}</span>
                      </div>
                      <p className="comment-text">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="comment-add">
              <input
                className="comment-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder={tr.addCommentPh}
              />
              <button className="comment-send" style={{ background: color.dot }} onClick={submitComment} aria-label="Send comment">
                <Icon.send />
              </button>
            </div>
          </div>
        </div>
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
  const [view, setView] = useState("home"); // "home" | "room" | "settings"
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch { return "en"; }
  });
  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const [commenterName, setCommenterName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  });
  useEffect(() => {
    try { localStorage.setItem(NAME_KEY, commenterName); } catch { /* ignore */ }
  }, [commenterName]);

  // Which task's detail popup is open, if any: { roomId, taskId } or null.
  const [detail, setDetail] = useState(null);
  // Resolve the popup's live data fresh from `rooms` each render, so it
  // stays in sync if the other person edits the same task.
  const detailRoom = detail ? rooms.find((r) => r.id === detail.roomId) : null;
  const detailTaskObj = detailRoom ? detailRoom.tasks.find((t) => t.id === detail.taskId) : null;
  useEffect(() => {
    if (detail && !detailTaskObj) setDetail(null); // task was deleted elsewhere — close cleanly
  }, [detail, detailTaskObj]);
  const tr = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const [roomsOpen, setRoomsOpen] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(SIDEBAR_KEY), 10);
      return Number.isFinite(v) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, v)) : SIDEBAR_DEFAULT;
    } catch { return SIDEBAR_DEFAULT; }
  });
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth)); } catch { /* ignore */ }
  }, [sidebarWidth]);

  const resizing = useRef(false);
  const startSidebarResize = (e) => {
    resizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, x)));
      if (e.touches) e.preventDefault();
    };
    const onUp = () => {
      if (!resizing.current) return;
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);
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

  // --- task detail popup (status + comments) ---
  const setTaskStatus = (roomId, taskId, statusValue) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId ? { ...t, done: statusValue === "done", status: statusValue } : t
      ),
    }));
  const addTaskComment = (roomId, taskId, text) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [
                ...(t.comments || []),
                { id: uid(), author: commenterName.trim() || tr.defaultCommenter, text, ts: Date.now() },
              ],
            }
          : t
      ),
    }));

  // --- drag reordering ---
  const reorderTasks = (newTasks) => update(active.id, (r) => ({ ...r, tasks: newTasks }));
  const reorderMaterials = (newMaterials) => update(active.id, (r) => ({ ...r, materials: newMaterials }));
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

  // The task detail popup can now open from the Planner too, which isn't
  // scoped to any one room — so its edit handlers take an explicit roomId
  // instead of assuming "the room currently open."
  const detailRenameTask = (roomId, taskId, text) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, text } : t)),
    }));
  const detailAddSub = (roomId, taskId, text) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...(t.subtasks || []), { id: uid(), text, done: false }] }
          : t
      ),
    }));
  const detailDeleteSub = (roomId, taskId, subId) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subId) }
          : t
      ),
    }));
  const detailRenameSub = (roomId, taskId, subId, text) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: (t.subtasks || []).map((s) => (s.id === subId ? { ...s, text } : s)) }
          : t
      ),
    }));
  const detailReorderSub = (roomId, taskId, newSubs) =>
    update(roomId, (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: newSubs } : t)),
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
    <>
    <div className="reno">
      {/* ---------------- sidebar ---------------- */}
      <aside className="side" style={{ width: sidebarWidth, flex: `0 0 ${sidebarWidth}px` }}>
        <div className="brand">
          <div className="brand-mark"><Icon.brandMark /></div>
          <span className="brand-name">RenoList</span>
        </div>

        <button
          className={"home-btn" + (view === "home" ? " active" : "")}
          onClick={() => setView("home")}
        >
          <Icon.home /> {tr.dashboard}
        </button>

        <button
          type="button"
          className={"rooms-toggle" + (roomsOpen ? " open" : "")}
          onClick={() => setRoomsOpen((o) => !o)}
        >
          <Icon.rooms /> {tr.rooms}
          <Icon.caret className="rooms-toggle-caret" />
        </button>

        {roomsOpen && (
          <>
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
          </>
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

      <div
        className="side-resizer"
        onMouseDown={startSidebarResize}
        onTouchStart={startSidebarResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />

      {/* ---------------- main ---------------- */}
      {!loaded ? (
        <main className="main loading"><div className="spinner" /></main>
      ) : view === "settings" ? (
        <Settings
          tr={tr}
          lang={lang}
          onSetLang={setLang}
          status={status}
          syncLabel={syncLabel}
          commenterName={commenterName}
          onSetCommenterName={setCommenterName}
        />
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
          onOpenDetail={(roomId, taskId) => setDetail({ roomId, taskId })}
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
                    onOpenDetail={(taskId) => setDetail({ roomId: active.id, taskId })}
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

    {detailTaskObj && detailRoom && (
      <TaskDetailModal
        task={detailTaskObj}
        room={detailRoom}
        color={colorAt(detailRoom.ci ?? rooms.indexOf(detailRoom))}
        tr={tr}
        onClose={() => setDetail(null)}
        onRename={(taskId, text) => detailRenameTask(detailRoom.id, taskId, text)}
        onSetStatus={(taskId, statusValue) => setTaskStatus(detailRoom.id, taskId, statusValue)}
        onAddSub={(taskId, text) => detailAddSub(detailRoom.id, taskId, text)}
        onToggleSub={(taskId, subId) => togglePlannerSubtask(detailRoom.id, taskId, subId)}
        onDeleteSub={(taskId, subId) => detailDeleteSub(detailRoom.id, taskId, subId)}
        onRenameSub={(taskId, subId, text) => detailRenameSub(detailRoom.id, taskId, subId, text)}
        onReorderSub={(taskId, newSubs) => detailReorderSub(detailRoom.id, taskId, newSubs)}
        onAddComment={(taskId, text) => addTaskComment(detailRoom.id, taskId, text)}
      />
    )}
    </>
  );
}
