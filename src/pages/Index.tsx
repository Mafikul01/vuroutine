import { useState, useEffect, useMemo, useRef } from "react";
import { DayPicker } from "@/components/DayPicker";
import { ClassCard } from "@/components/ClassCard";
import {
  SEMESTERS,
  SEMESTER_SECTIONS,
  SLOTS,
  DAYS,
  getTodayName,
  getClassesForStudent,
  getClassesForTeacher,
  getTeacherList,
  normalizeTeacherName,
  ClassEntry,
  routineData as staticRoutineData,
} from "@/data/routineData";
import { GraduationCap, User, ArrowLeftRight, BookOpen, Search, RefreshCcw, LayoutGrid, MapPin, Clock, Phone, SearchCheck, Menu, Info, Users, Code, Github, Facebook, Linkedin, MessageCircle } from "lucide-react";
import { getGoogleSheetCsvUrlByGid, parseRoutineCsv, parseTeacherCsv } from "@/lib/parser";
import { toast } from "sonner";
import { Teacher } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DEFAULT_SHEET = "https://docs.google.com/spreadsheets/d/1Sdmr60rcZeBCa2ofswUr9mxIreIj71W9HYM1RRhvfMM/edit";
const INFO_GID = "989827005";

const SEMESTER_GIDS: Record<number, string> = {
  1: "0",
  2: "1739684797",
  3: "1812971555",
  4: "1642366900",
  5: "1698922910",
  6: "1687685897",
  7: "2130237812",
  8: "1780568258",
  9: "614628609",
};

type Role = "student" | "teacher" | null;

export default function Index() {
  const [role, setRole] = useState<Role>(() => {
    return (localStorage.getItem("routine-role") as Role) || null;
  });
  const [semester, setSemester] = useState(() => Number(localStorage.getItem("routine-semester")) || 1);
  const [section, setSection] = useState(() => localStorage.getItem("routine-section") || "A");
  const [selectedTeacher, setSelectedTeacher] = useState(() => localStorage.getItem("routine-teacher") || "");
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = getTodayName();
    return DAYS.includes(today as typeof DAYS[number]) ? today : "Sunday";
  });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [currentRoutine, setCurrentRoutine] = useState<ClassEntry[]>(staticRoutineData);
  const [teacherInfo, setTeacherInfo] = useState<Teacher[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  
  // Room Finder states
  const [isRoomFinderOpen, setIsRoomFinderOpen] = useState(false);
  const [roomFinderMode, setRoomFinderMode] = useState<"room" | "time">("room");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(1);

  // Detail Dialog states
  const [selectedEntry, setSelectedEntry] = useState<ClassEntry | null>(null);

  // App Menu states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTeacherDirOpen, setIsTeacherDirOpen] = useState(false);
  const [isDevInfoOpen, setIsDevInfoOpen] = useState(false);
  const [dirSearchTerm, setDirSearchTerm] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDynamicRoutine = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch Teachers Info
      const infoUrl = getGoogleSheetCsvUrlByGid(DEFAULT_SHEET, INFO_GID);
      const infoResponse = await fetch(infoUrl);
      if (infoResponse.ok) {
        const infoCsv = await infoResponse.text();
        const teachers = parseTeacherCsv(infoCsv);
        setTeacherInfo(teachers);
      }

      // 2. Fetch Routine
      // If student, we can optimize by only fetching the needed semester!
      // But role could be dynamic, so let's fetch all 9 semesters simultaneously. 
      // It's lightning fast now that it's direct CSV parsing.
      let allSessions: ClassEntry[] = [];
      const sessionPromises = Object.entries(SEMESTER_GIDS).map(async ([sem, gid]) => {
        const csvUrl = getGoogleSheetCsvUrlByGid(DEFAULT_SHEET, gid);
        const response = await fetch(csvUrl);
        if (!response.ok) return [];
        const csvText = await response.text();
        return parseRoutineCsv(csvText, parseInt(sem, 10));
      });

      const results = await Promise.all(sessionPromises);
      allSessions = results.flat();

      if (allSessions.length > 0) {
        setCurrentRoutine(allSessions);
        setLastSynced(new Date().toLocaleTimeString());
        toast.success("Routine updated live from Google Sheet");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Using offline routine data");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDynamicRoutine();
  }, []);

  const teachers = getTeacherList(currentRoutine);
  const availableSections = useMemo(() => SEMESTER_SECTIONS[semester] || ["A"], [semester]);

  // Reset section if not valid for current semester
  useEffect(() => {
    if (!availableSections.includes(section)) {
      setSection(availableSections[0]);
    }
  }, [semester, availableSections, section]);

  useEffect(() => {
    if (role) localStorage.setItem("routine-role", role);
    localStorage.setItem("routine-semester", String(semester));
    localStorage.setItem("routine-section", section);
    localStorage.setItem("routine-teacher", selectedTeacher);
  }, [role, semester, section, selectedTeacher]);

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    if (r === "teacher" && !selectedTeacher && teachers.length > 0) {
      setSelectedTeacher(teachers[0]);
    }
  };

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Class Routine</h1>
            <p className="mt-1 text-sm text-muted-foreground">CSE Department</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">I am a</p>
            <button
              onClick={() => handleRoleSelect("student")}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold">Student</p>
                <p className="text-xs text-muted-foreground">View your section's routine</p>
              </div>
            </button>
            <button
              onClick={() => handleRoleSelect("teacher")}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <User className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-heading font-semibold">Teacher</p>
                <p className="text-xs text-muted-foreground">View your daily classes</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allRooms = Array.from(new Set(currentRoutine.map(e => e.room))).sort();

  const getClassesByRoom = (day: string, room: string) => {
    return currentRoutine
      .filter(e => e.day === day && e.room === room)
      .sort((a, b) => a.slot - b.slot);
  };

  const getClassesBySlot = (day: string, slot: number) => {
    return currentRoutine
      .filter(e => e.day === day && e.slot === slot)
      .sort((a, b) => a.room.localeCompare(b.room));
  };

  const classes =
    role === "student"
      ? getClassesForStudent(selectedDay, semester, section, currentRoutine)
      : getClassesForTeacher(selectedDay, selectedTeacher, currentRoutine);

  const filteredTeachers = teacherSearch
    ? teachers.filter(t => normalizeTeacherName(t).includes(normalizeTeacherName(teacherSearch)))
    : teachers;

  return (
    <div className="mx-auto min-h-screen max-w-lg p-4 pb-20 relative">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg font-bold">
            {role === "student" ? "My Routine" : "My Classes"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {role === "student"
              ? `${semester}${semester === 1 ? "st" : semester === 2 ? "nd" : semester === 3 ? "rd" : "th"} Semester • Section ${section}`
              : selectedTeacher}
          </p>
          {lastSynced && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              Synced at {lastSynced}
            </p>
          )}
        </div>
        <div className="flex gap-2 relative" ref={menuRef}>
          <button
            onClick={fetchDynamicRoutine}
            disabled={isSyncing}
            className={`flex items-center justify-center rounded-lg bg-secondary p-2 transition-all hover:bg-secondary/80 ${isSyncing ? "animate-spin opacity-50" : ""}`}
            title="Refresh from Google Sheet"
          >
            <RefreshCcw className="h-4 w-4 text-secondary-foreground" />
          </button>
          <button
            onClick={() => setRole(null)}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Switch
          </button>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-center rounded-lg bg-secondary p-2 transition-all hover:bg-secondary/80"
            title="Menu"
          >
            <Menu className="h-4 w-4 text-secondary-foreground" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border bg-card p-1 shadow-lg z-40 animate-fade-in">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsTeacherDirOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <Users className="h-4 w-4" />
                Teacher Directory
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsDevInfoOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
              >
                <Info className="h-4 w-4" />
                Dev Info
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Student: Semester picker */}
      {role === "student" && (
        <>
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Semester</label>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {SEMESTERS.map(sem => (
                <button
                  key={sem}
                  onClick={() => setSemester(sem)}
                  className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                    semester === sem
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {sem}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Section</label>
            <div className="flex gap-1.5">
              {availableSections.map(sec => (
                <button
                  key={sec}
                  onClick={() => setSection(sec)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                    section === sec
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Teacher: Search picker */}
      {role === "teacher" && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Teacher</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search teacher..."
              value={teacherSearch}
              onChange={e => setTeacherSearch(e.target.value)}
              className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          {teacherSearch && (
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border bg-card">
              {filteredTeachers.map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setSelectedTeacher(t);
                    setTeacherSearch("");
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                    selectedTeacher === t ? "bg-secondary font-medium" : ""
                  }`}
                >
                  {t}
                </button>
              ))}
              {filteredTeachers.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No match</p>
              )}
            </div>
          )}
          {!teacherSearch && selectedTeacher && (
            <p className="mt-1 text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{selectedTeacher}</span>
            </p>
          )}
        </div>
      )}

      {/* Day picker */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Day</label>
        <DayPicker selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      </div>

      {/* Classes list */}
      <div className="space-y-3">
        {classes.length > 0 ? (
          classes.map((entry, i) => (
            <div 
              key={`${entry.course}-${entry.slot}-${entry.section}-${i}`} 
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => setSelectedEntry(entry)}
              className="cursor-pointer transition-transform active:scale-[0.98]"
            >
              <ClassCard entry={entry} showSection={role !== "student"} />
            </div>
          ))
        ) : (
          <div className="rounded-xl border bg-card p-8 text-center">
            <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {`No classes on ${selectedDay}`}
            </p>
          </div>
        )}
      </div>

      {/* Room Finder FAB & Dialog */}
      <Dialog open={isRoomFinderOpen} onOpenChange={setIsRoomFinderOpen}>
        <DialogTrigger asChild>
          <button className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95 z-50">
            <SearchCheck className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Room Finder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-1.5">
              <button
                onClick={() => setRoomFinderMode("room")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  roomFinderMode === "room"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Find by Room
              </button>
              <button
                onClick={() => setRoomFinderMode("time")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  roomFinderMode === "time"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Clock className="h-4 w-4" />
                Find by Time
              </button>
            </div>

            {roomFinderMode === "room" && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">Select Room</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                    className="w-full appearance-none rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Choose a room...</option>
                    {allRooms.map(room => (
                      <option key={room} value={room}>{room}</option>
                    ))}
                  </select>
                </div>
                {selectedRoom && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Classes in {selectedRoom} on {selectedDay}</p>
                    {getClassesByRoom(selectedDay, selectedRoom).length > 0 ? (
                      getClassesByRoom(selectedDay, selectedRoom).map((entry, i) => (
                        <div key={i} className="rounded-lg border p-3 flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {entry.startTime || SLOTS.find(s => s.slot === entry.slot)?.start} - {entry.endTime || SLOTS.find(s => s.slot === entry.slot)?.end}
                            </span>
                          </div>
                          <span className="font-medium text-sm">{entry.course} ({entry.section})</span>
                          <span className="text-xs text-muted-foreground">{entry.teachers.join(", ")}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-green-600 font-medium bg-green-50 p-3 rounded-lg border border-green-100 dark:bg-green-900/20 dark:border-green-900/30">
                        Room is free all day!
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {roomFinderMode === "time" && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">Select Time</label>
                <div className="flex flex-col gap-2">
                  {SLOTS.map(s => {
                    const isSelected = selectedSlot === s.slot;
                    return (
                      <button
                        key={s.slot}
                        onClick={() => setSelectedSlot(s.slot)}
                        className={`text-left rounded-lg px-4 py-3 text-sm font-medium transition-all border ${
                          isSelected
                            ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm"
                            : "bg-card border-border hover:border-blue-300"
                        }`}
                      >
                        {s.start} - {s.end}
                      </button>
                    )
                  })}
                </div>

                {selectedSlot && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">Availability at {SLOTS.find(s => s.slot === selectedSlot)?.start} - {SLOTS.find(s => s.slot === selectedSlot)?.end}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {allRooms.map(room => {
                        const classesInSlot = getClassesBySlot(selectedDay, selectedSlot);
                        const occupyingClass = classesInSlot.find(c => c.room === room);
                        const isFree = !occupyingClass;
                        return (
                          <div key={room} className={`p-3 rounded-lg border ${isFree ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900/30' : 'border-red-100 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/20'}`}>
                            <div className="font-bold text-sm mb-1">{room}</div>
                            {isFree ? (
                              <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-green-600 dark:text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" /> FREE
                              </span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider text-red-500 dark:text-red-400 mb-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" /> NOT AVAILABLE
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate" title={`${occupyingClass.course} (${occupyingClass.section})`}>
                                  {occupyingClass.course} ({occupyingClass.section})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">{selectedEntry?.course}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Class Time</p>
                <p className="text-sm font-semibold">
                  {selectedEntry?.startTime} - {selectedEntry?.endTime || SLOTS.find(s => s.slot === selectedEntry?.slot)?.end}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <MapPin className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Location</p>
                <p className="text-sm font-semibold">Room {selectedEntry?.room}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Teacher Info</p>
              {selectedEntry?.teachers.map((name, idx) => {
                const normName = normalizeTeacherName(name);
                const info = teacherInfo.find(t => {
                  const normTName = normalizeTeacherName(t.name);
                  const normTInitials = normalizeTeacherName(t.initials || "");
                  return normTName.includes(normName) || normName.includes(normTName) || (normTInitials && normTInitials === normName);
                });
                return (
                  <div key={idx} className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                        <User className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{info?.name || name}</p>
                        <p className="text-xs text-muted-foreground">{info?.designation || "Faculty Member"}</p>
                      </div>
                    </div>
                    {info?.phone && (
                      <a 
                        href={`tel:${info.phone}`}
                        className="flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm text-primary transition-colors hover:bg-primary/10"
                      >
                        <Phone className="h-4 w-4" />
                        <span>{info.phone}</span>
                        <span className="ml-auto text-xs opacity-60">Call now</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Teacher Directory Dialog */}
      <Dialog open={isTeacherDirOpen} onOpenChange={setIsTeacherDirOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Teacher Directory
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 border-b pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, initials, or designation..."
                value={dirSearchTerm}
                onChange={e => setDirSearchTerm(e.target.value)}
                className="w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
            {teacherInfo
              .filter(t => 
                t.name.toLowerCase().includes(dirSearchTerm.toLowerCase()) || 
                (t.initials && t.initials.toLowerCase().includes(dirSearchTerm.toLowerCase())) ||
                (t.designation && t.designation.toLowerCase().includes(dirSearchTerm.toLowerCase()))
              )
              .map((teacher, idx) => (
                <div key={idx} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                      <span className="font-bold text-accent text-sm">{teacher.initials || <User className="h-5 w-5" />}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{teacher.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{teacher.designation || "Faculty Member"}</p>
                    </div>
                  </div>
                  {teacher.phone && (
                    <a 
                      href={`tel:${teacher.phone}`}
                      className="flex items-center gap-2 rounded-lg bg-primary/5 p-2 text-sm text-primary transition-colors hover:bg-primary/10"
                    >
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{teacher.phone}</span>
                      <span className="ml-auto text-xs opacity-60">Call</span>
                    </a>
                  )}
                </div>
              ))}
            {teacherInfo.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading teacher data...
              </div>
            )}
            {teacherInfo.length > 0 && dirSearchTerm && !teacherInfo.some(t => 
                t.name.toLowerCase().includes(dirSearchTerm.toLowerCase()) || 
                (t.initials && t.initials.toLowerCase().includes(dirSearchTerm.toLowerCase())) ||
                (t.designation && t.designation.toLowerCase().includes(dirSearchTerm.toLowerCase()))
              ) && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No teachers found matching "{dirSearchTerm}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Developer Info Dialog */}
      <Dialog open={isDevInfoOpen} onOpenChange={setIsDevInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold flex items-center gap-2">
              <Code className="h-5 w-5 text-indigo-500" />
              Developer Info
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center py-4">
              <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg relative overflow-hidden">
                <span className="text-3xl font-heading font-bold">MI</span>
              </div>
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-heading text-2xl font-bold">Mafikul Islam</h3>
              <p className="text-sm font-medium text-primary">Student ID: 2323111070</p>
              <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">6th Semester • Section B</p>
              <p className="text-xs text-muted-foreground pt-2">
                Developer & Maintainer of the CSE Class Routine App
              </p>
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <a 
                href="https://wa.me/8801788302771" 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 transition-colors hover:bg-green-500 hover:text-white"
                title="WhatsApp"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a 
                href="https://github.com/mafikul01" 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-foreground hover:text-background"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a 
                href="https://facebook.com/mafikul01" 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
                title="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="https://linkedin.com/in/mafikul01" 
                target="_blank" 
                rel="noreferrer" 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700/10 text-blue-700 transition-colors hover:bg-blue-700 hover:text-white"
                title="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
            
            <div className="mt-6 rounded-xl border bg-secondary/30 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">App Features</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Lightning Fast Google Sheets Sync
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Dynamic Real-time Room Finder
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Smart Teacher Directory Integration
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
