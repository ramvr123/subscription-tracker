"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import { useUser } from "@/lib/useUser";

async function loadSubscriptions() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*");

  if (error) {
    console.error("Error loading subscriptions:", error);
    return [];
  }

  return data;
}

async function addSubscription(sub: Omit<Subscription, "id">, userId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      name: sub.name,
      price: sub.price,
      cycle: sub.billingCycle,              // FIXED
      next_billing_date: sub.nextRenewal,   // FIXED
      logo: null                            // or sub.logo if you have it
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding subscription:", error);
    return null;
  }

  return data;
}

async function updateSubscription(id: string, updates: Partial<Subscription>) {
  const mapped = {
    ...(updates.name !== undefined && { name: updates.name }),
    ...(updates.price !== undefined && { price: updates.price }),
    ...(updates.billingCycle !== undefined && { cycle: updates.billingCycle }),
    ...(updates.nextRenewal !== undefined && { next_billing_date: updates.nextRenewal }),
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .update(mapped)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating subscription:", error);
    return null;
  }

  return data;
}

async function deleteSubscription(id: string) {
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting subscription:", error);
    return false;
  }

  return true;
}


type BillingCycle = "monthly" | "yearly";

type Subscription = {
  id: string;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  nextRenewal: string; // ISO date string
};

type SortOption = "name" | "price" | "nextRenewal" | "billingCycle";
type FilterOption = "all" | "monthly" | "yearly" | "renewingThisMonth";

const STORAGE_KEY = "subscription-tracker-data-v1";
const THEME_KEY = "subscription-tracker-theme-v1";

const initialSubscriptions: Subscription[] = [
  {
    id: "netflix",
    name: "Netflix",
    price: 15.99,
    billingCycle: "monthly",
    nextRenewal: "2025-03-15"
  },
  {
    id: "amazon-prime",
    name: "Amazon Prime",
    price: 8.99,
    billingCycle: "monthly",
    nextRenewal: "2025-03-10"
  },
  {
    id: "chatgpt-plus",
    name: "ChatGPT Plus",
    price: 20,
    billingCycle: "monthly",
    nextRenewal: "2025-03-05"
  },
  {
    id: "chatgpt-g",
    name: "ChatGPT G",
    price: 10,
    billingCycle: "monthly",
    nextRenewal: "2025-03-12"
  },
  {
    id: "m365-family",
    name: "Microsoft 365 Family",
    price: 108,
    billingCycle: "yearly",
    nextRenewal: "2025-11-01"
  },
  {
    id: "mcafee",
    name: "McAfee",
    price: 59.99,
    billingCycle: "yearly",
    nextRenewal: "2025-09-20"
  },
  {
    id: "lenovo-smart-performance",
    name: "Lenovo Smart Performance",
    price: 39.99,
    billingCycle: "yearly",
    nextRenewal: "2025-07-15"
  }
];

function toMonthly(price: number, cycle: BillingCycle) {
  return cycle === "monthly" ? price : price / 12;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isRenewingThisMonth(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function Home() {
  // 1. ALWAYS RUN HOOKS FIRST
  const { user, loading } = useUser();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formBillingCycle, setFormBillingCycle] = useState<BillingCycle>("monthly");
  const [formNextRenewal, setFormNextRenewal] = useState("");

  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // 2. EFFECTS NEXT
  useEffect(() => {
    loadSubscriptions().then((rows) => {
      setSubscriptions(rows);
    });

    try {
      const storedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | null;
      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (subscriptions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    }
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // 3. ONLY NOW: CONDITIONAL RETURNS
  if (loading) return <p>Loading...</p>;

  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  const resetForm = () => {
    setFormName("");
    setFormPrice("");
    setFormBillingCycle("monthly");
    setFormNextRenewal("");
    setEditing(null);
  };

  const startEdit = (sub: Subscription) => {
    setEditing(sub);
    setFormName(sub.name);
    setFormPrice(sub.price.toString());
    setFormBillingCycle(sub.billingCycle);
    setFormNextRenewal(sub.nextRenewal);
  };

  const handleDelete = (id: string) => {
  if (!confirm("Delete this subscription?")) return;

  deleteSubscription(id).then((success) => {
    if (success) {
      setSubscriptions(prev => prev.filter(s => s.id !== id));
      if (editing && editing.id === id) resetForm();
    }
  });
};


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(formPrice);
    if (!formName.trim() || isNaN(priceNum) || !formNextRenewal) {
      alert("Please fill all fields with valid values.");
      return;
    }

    if (editing) {
  updateSubscription(editing.id, {
    name: formName.trim(),
    price: priceNum,
    billingCycle: formBillingCycle,
    nextRenewal: formNextRenewal
  }).then((updated) => {
    if (updated) {
      setSubscriptions(prev =>
        prev.map(s => (s.id === updated.id ? updated : s))
      );
    }
  });

    } else {
  const newSub = {
    name: formName.trim(),
    price: priceNum,
    billingCycle: formBillingCycle,
    nextRenewal: formNextRenewal
  };

  if (!user) return;
  const userId = user.id;
  addSubscription(newSub, user.id).then((created) => {
  if (created) {
    setSubscriptions(prev => [...prev, created]);
  }
});
}

    resetForm();
  };

  const handleExportCSV = () => {
    if (subscriptions.length === 0) {
      alert("No subscriptions to export.");
      return;
    }

    const header = ["Name", "Price", "Billing Cycle", "Next Renewal"];
    const rows = subscriptions.map(s => [
      s.name,
      s.price.toString(),
      s.billingCycle,
      formatDate(s.nextRenewal)
    ]);

    const csvContent =
      [header, ...rows]
        .map(row =>
          row
            .map(field => {
              const f = field.replace(/"/g, '""');
              return `"${f}"`;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  // Derived: sorted + filtered subscriptions
  const filteredSortedSubscriptions = (() => {
    let list = [...subscriptions];

    // Filter
    if (filterBy === "monthly") {
      list = list.filter(s => s.billingCycle === "monthly");
    } else if (filterBy === "yearly") {
      list = list.filter(s => s.billingCycle === "yearly");
    } else if (filterBy === "renewingThisMonth") {
      list = list.filter(s => isRenewingThisMonth(s.nextRenewal));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "price") {
        return a.price - b.price;
      }
      if (sortBy === "nextRenewal") {
        const da = new Date(a.nextRenewal).getTime();
        const db = new Date(b.nextRenewal).getTime();
        return da - db;
      }
      if (sortBy === "billingCycle") {
        if (a.billingCycle === b.billingCycle) return a.name.localeCompare(b.name);
        return a.billingCycle === "monthly" ? -1 : 1;
      }
      return 0;
    });

    return list;
  })();

  const totalMonthly = subscriptions.reduce(
    (sum, s) => sum + toMonthly(s.price, s.billingCycle),
    0
  );
  const totalYearly = totalMonthly * 12;

  const byProvider = subscriptions.reduce<Record<string, number>>((acc, s) => {
    const monthly = toMonthly(s.price, s.billingCycle);
    acc[s.name] = (acc[s.name] || 0) + monthly;
    return acc;
  }, {});

  const mainBg = theme === "dark" ? "bg-gray-900" : "bg-gray-100";
  const mainText = theme === "dark" ? "text-gray-100" : "text-gray-900";
  const cardBg = theme === "dark" ? "bg-gray-800" : "bg-white";
  const cardBorder = theme === "dark" ? "border-gray-700" : "border-gray-200";

  return (
    <main className={`min-h-screen ${mainBg} ${mainText} p-8`}>
      <div className="max-w-6xl mx-auto">

      {/* 🔥 SAFE LOGOUT BUTTON — DOES NOT BREAK ANYTHING */}
      <div className="flex justify-end mb-4">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="px-3 py-1 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </div>
      {/* 🔥 END LOGOUT BUTTON */}


        <h1 className="text-3xl font-bold mb-6">Subscription Tracker</h1>

        {/* Controls Bar */}
        <div
          className={`mb-6 p-4 rounded-xl shadow border flex flex-wrap gap-4 items-center ${cardBg} ${cardBorder}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sort By:</span>
            <select
              className={`border rounded px-3 py-2 text-sm ${
                theme === "dark"
                  ? "bg-gray-900 border-gray-700 text-gray-100"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
            >
              <option value="name">Name (A → Z)</option>
              <option value="price">Price (Low → High)</option>
              <option value="nextRenewal">Next Renewal (Soonest → Latest)</option>
              <option value="billingCycle">Billing Cycle (Monthly → Yearly)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter By:</span>
            <select
              className={`border rounded px-3 py-2 text-sm ${
                theme === "dark"
                  ? "bg-gray-900 border-gray-700 text-gray-100"
                  : "bg-white border-gray-300 text-gray-900"
              }`}
              value={filterBy}
              onChange={e => setFilterBy(e.target.value as FilterOption)}
            >
              <option value="all">All</option>
              <option value="monthly">Monthly Only</option>
              <option value="yearly">Yearly Only</option>
              <option value="renewingThisMonth">Renewing This Month</option>
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export CSV
          </button>

          <button
            onClick={toggleTheme}
            className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 ml-auto"
          >
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>

        {/* Subscription Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredSortedSubscriptions.map(sub => (
            <div
              key={sub.id}
              className={`p-6 rounded-xl shadow border ${cardBg} ${cardBorder}`}
            >
              <h2 className="text-xl font-semibold mb-2">{sub.name}</h2>

              <p className="text-sm">
                <span className="font-semibold">Price:</span>{" "}
                ${sub.price.toFixed(2)} {sub.cycle ? `/${sub.cycle}` : ""}
              </p>

              <p className="text-sm mt-1">
                <span className="font-semibold">Next Renewal:</span>{" "}
                {formatDate(sub.next_billing_date)}
              </p>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => startEdit(sub)}
                  className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(sub.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {filteredSortedSubscriptions.length === 0 && (
            <p className="text-sm col-span-full">
              No subscriptions match the current filter.
            </p>
          )}
        </div>

        {/* Add / Edit Form */}
        <div className={`mb-8 p-6 rounded-xl shadow border ${cardBg} ${cardBorder}`}>
          <h2 className="text-xl font-semibold mb-4">
            {editing ? `Edit Subscription: ${editing.name}` : "Add New Subscription"}
          </h2>

          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                className={`w-full border rounded px-3 py-2 text-sm ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Netflix, ChatGPT Plus"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Price</label>
              <input
                className={`w-full border rounded px-3 py-2 text-sm ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                value={formPrice}
                onChange={e => setFormPrice(e.target.value)}
                placeholder="e.g. 15.99"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Billing Cycle</label>
              <select
                className={`w-full border rounded px-3 py-2 text-sm ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                value={formBillingCycle}
                onChange={e => setFormBillingCycle(e.target.value as BillingCycle)}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Next Renewal Date</label>
              <input
                type="date"
                className={`w-full border rounded px-3 py-2 text-sm ${
                  theme === "dark"
                    ? "bg-gray-900 border-gray-700 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                value={formNextRenewal ?? ""}
                onChange={e => setFormNextRenewal(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex gap-3 mt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                {editing ? "Save Changes" : "Add Subscription"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Summary */}
        <div className={`mb-4 p-6 rounded-xl shadow border ${cardBg} ${cardBorder}`}>
          <h2 className="text-xl font-semibold mb-2">Summary</h2>

          <p className="text-lg">
            <span className="font-semibold">Total Monthly Cost:</span>{" "}
            <span className="text-2xl font-bold text-green-500">
              ${totalMonthly.toFixed(2)}
            </span>
          </p>

          <p className="text-lg mt-1">
            <span className="font-semibold">Total Yearly Cost:</span>{" "}
            <span className="text-xl font-bold text-blue-400">
              ${totalYearly.toFixed(2)}
            </span>
          </p>

          <div className="mt-4">
            <h3 className="font-semibold mb-1">Monthly Cost by Provider:</h3>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(byProvider).map(([name, value]) => (
                <li key={name}>
                  {name}: ${value.toFixed(2)} / month
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}