(() => {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const STORAGE_KEY = "workoutPlanner.week.v1";

  const $ = (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Missing element: ${sel}`);
    return el;
  };

  const normalizeMuscle = (value) => value.trim().toLowerCase();
  const titleCase = (value) =>
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const safeText = (value) => (value ?? "").toString();

  const uid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const defaultWeek = () =>
    DAYS.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});

  const loadWeek = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultWeek();
      const parsed = JSON.parse(raw);
      const week = defaultWeek();

      for (const day of DAYS) {
        const items = Array.isArray(parsed?.[day]) ? parsed[day] : [];
        week[day] = items
          .filter((it) => it && typeof it === "object")
          .map((it) => ({
            id: safeText(it.id) || uid(),
            exercise: safeText(it.exercise || "").trim(),
            muscle: safeText(it.muscle || "").trim(),
            createdAt: Number(it.createdAt) || Date.now(),
          }))
          .filter((it) => it.muscle.length > 0);
      }

      return week;
    } catch {
      return defaultWeek();
    }
  };

  const saveWeek = (week) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(week));
  };

  const musclesForDay = (week, day) => {
    const set = new Set();
    for (const item of week[day] ?? []) {
      const m = normalizeMuscle(item.muscle);
      if (m) set.add(m);
    }
    return set;
  };

  const computeConsecutiveWarnings = (week) => {
    const warnings = [];

    for (let i = 0; i < DAYS.length - 1; i++) {
      const d1 = DAYS[i];
      const d2 = DAYS[i + 1];

      const m1 = musclesForDay(week, d1);
      const m2 = musclesForDay(week, d2);
      const overlap = [];

      for (const m of m1) {
        if (m2.has(m)) overlap.push(m);
      }

      if (overlap.length > 0) {
        warnings.push({
          fromDay: d1,
          toDay: d2,
          muscles: overlap,
        });
      }
    }

    return warnings;
  };

  const renderDaySelect = () => {
    const sel = $("#daySelect");
    sel.innerHTML = "";
    for (const day of DAYS) {
      const opt = document.createElement("option");
      opt.value = day;
      opt.textContent = day;
      sel.appendChild(opt);
    }
  };

  const render = (week) => {
    const weekGrid = $("#weekGrid");
    const warningSummary = $("#warningSummary");

    const warnings = computeConsecutiveWarnings(week);

    if (warnings.length === 0) {
      warningSummary.innerHTML = `<span class="badge badge-ok">No consecutive-day muscle conflicts</span>`;
    } else {
      const count = warnings.reduce((acc, w) => acc + w.muscles.length, 0);
      warningSummary.innerHTML = `<span class="badge badge-danger"><strong>${count}</strong> consecutive-day muscle conflict${count === 1 ? "" : "s"}</span>`;
    }

    const warningByDay = new Map();
    for (const w of warnings) {
      warningByDay.set(w.toDay, w);
    }

    weekGrid.innerHTML = "";

    for (const day of DAYS) {
      const card = document.createElement("section");
      card.className = "day-card";

      const header = document.createElement("div");
      header.className = "day-card-header";

      const title = document.createElement("div");
      title.className = "day-title";
      title.textContent = day;

      const sub = document.createElement("div");
      sub.className = "day-sub";

      const items = Array.isArray(week[day]) ? week[day] : [];
      const muscles = Array.from(musclesForDay(week, day)).map(titleCase);

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = muscles.length === 0 ? "Rest / Unassigned" : `${muscles.length} muscle${muscles.length === 1 ? "" : "s"}`;

      sub.appendChild(badge);

      const warning = warningByDay.get(day);
      if (warning) {
        const wBadge = document.createElement("span");
        wBadge.className = "badge badge-danger";
        const musclesText = warning.muscles.map(titleCase).join(", ");
        wBadge.textContent = `Warning: also trained yesterday (${musclesText})`;
        sub.appendChild(wBadge);
      }

      header.appendChild(title);
      header.appendChild(sub);

      const list = document.createElement("div");
      list.className = "items";

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "help";
        empty.textContent = "No exercises added yet.";
        list.appendChild(empty);
      } else {
        for (const it of items) {
          const row = document.createElement("div");
          row.className = "item";

          const top = document.createElement("div");
          top.className = "item-top";

          const left = document.createElement("div");

          const t = document.createElement("div");
          t.className = "item-title";
          t.textContent = it.exercise ? it.exercise : titleCase(it.muscle);

          const meta = document.createElement("div");
          meta.className = "item-meta";

          const m = document.createElement("span");
          m.textContent = `Muscle: ${titleCase(it.muscle)}`;
          meta.appendChild(m);

          if (it.exercise) {
            const e = document.createElement("span");
            e.textContent = `Exercise: ${it.exercise}`;
            meta.appendChild(e);
          }

          left.appendChild(t);
          left.appendChild(meta);

          const del = document.createElement("button");
          del.className = "icon-button";
          del.type = "button";
          del.textContent = "Remove";
          del.addEventListener("click", () => {
            week[day] = (week[day] ?? []).filter((x) => x.id !== it.id);
            saveWeek(week);
            render(week);
          });

          top.appendChild(left);
          top.appendChild(del);

          row.appendChild(top);
          list.appendChild(row);
        }
      }

      card.appendChild(header);
      card.appendChild(list);
      weekGrid.appendChild(card);
    }
  };

  const addSampleWeek = (week) => {
    const sample = {
      Monday: [{ exercise: "Bench Press", muscle: "Chest" }],
      Tuesday: [{ exercise: "Push-ups", muscle: "Chest" }],
      Wednesday: [{ exercise: "Pull-ups", muscle: "Back" }],
      Thursday: [{ exercise: "Squat", muscle: "Legs" }],
      Friday: [{ exercise: "Overhead Press", muscle: "Shoulders" }],
      Saturday: [{ exercise: "Bicep Curls", muscle: "Biceps" }],
      Sunday: [],
    };

    for (const day of DAYS) {
      const items = Array.isArray(sample[day]) ? sample[day] : [];
      week[day] = items.map((it) => ({
        id: uid(),
        exercise: it.exercise,
        muscle: it.muscle,
        createdAt: Date.now(),
      }));
    }

    saveWeek(week);
    render(week);
  };

  const main = () => {
    renderDaySelect();

    const week = loadWeek();
    render(week);

    const form = $("#addForm");
    const daySelect = $("#daySelect");
    const exerciseInput = $("#exerciseInput");
    const muscleInput = $("#muscleInput");
    const clearBtn = $("#clearBtn");
    const seedBtn = $("#seedBtn");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const day = daySelect.value;
      const exercise = exerciseInput.value.trim();
      const muscleRaw = muscleInput.value.trim();

      if (!day || !DAYS.includes(day)) return;
      if (!muscleRaw) return;

      const item = {
        id: uid(),
        exercise,
        muscle: titleCase(muscleRaw),
        createdAt: Date.now(),
      };

      week[day] = Array.isArray(week[day]) ? week[day] : [];
      week[day].push(item);
      saveWeek(week);
      render(week);

      exerciseInput.value = "";
      muscleInput.value = "";
      muscleInput.focus();
    });

    clearBtn.addEventListener("click", () => {
      const ok = confirm("Clear the entire week? This cannot be undone.");
      if (!ok) return;
      const cleared = defaultWeek();
      for (const day of DAYS) week[day] = cleared[day];
      saveWeek(week);
      render(week);
    });

    seedBtn.addEventListener("click", () => {
      addSampleWeek(week);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
