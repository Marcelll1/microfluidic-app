"use client";

import { useState, useEffect } from "react";

type Friend = {
  id: string; // The friend request/connection id
  status: "pending" | "accepted";
  isInitiator: boolean;
  friend: {
    id: string;
    email: string;
  };
};

type SearchedUser = {
  id: string;
  email: string;
};

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      if (data.friends) {
        setFriends(data.friends);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length < 3) return;
    
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.users) {
        setSearchResults(data.users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendRequest = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (res.ok) {
        fetchFriends();
        setSearchResults([]);
        setSearchQuery("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const respondRequest = async (id: string, accept: boolean) => {
    try {
      if (accept) {
        await fetch(`/api/friends/${id}`, { method: "PATCH" });
      } else {
        await fetch(`/api/friends/${id}`, { method: "DELETE" });
      }
      fetchFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const removeFriend = async (id: string) => {
    try {
      await fetch(`/api/friends/${id}`, { method: "DELETE" });
      fetchFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const acceptedFriends = friends.filter((f) => f.status === "accepted");
  const pendingIncoming = friends.filter((f) => f.status === "pending" && !f.isInitiator);
  const pendingOutgoing = friends.filter((f) => f.status === "pending" && f.isInitiator);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold mb-6">Friends</h1>

      {/* Section 1: Search */}
      <section className="bg-[var(--card-bg)] p-6 rounded-lg text-[var(--foreground)]">
        <h2 className="text-xl font-semibold border-b border-[var(--border)] pb-2 mb-4">Add a Friend</h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            className="input-field flex-1 text-black p-2 rounded"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="button-primary bg-indigo-600 px-4 py-2 rounded hover:bg-indigo-700">
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {searchResults.map((user) => (
              <div key={user.id} className="flex justify-between items-center bg-[var(--item-bg-alpha)] p-3 rounded">
                <span>{user.email}</span>
                <button
                  onClick={() => sendRequest(user.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                >
                  Send Request
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Pending incoming requests */}
      <section className="bg-[var(--card-bg)] p-6 rounded-lg text-[var(--foreground)]">
        <h2 className="text-xl font-semibold border-b border-[var(--border)] pb-2 mb-4">Pending Requests</h2>
        {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
          <p className="text-[var(--muted)]">No pending requests.</p>
        )}

        {pendingIncoming.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium text-[var(--foreground)] mb-2">Incoming</h3>
            <ul className="space-y-2">
              {pendingIncoming.map((req) => (
                <li key={req.id} className="flex justify-between items-center bg-[var(--item-bg-alpha)] p-3 rounded">
                  <span>{req.friend.email}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondRequest(req.id, true)}
                      className="bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-sm text-white"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondRequest(req.id, false)}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm text-white"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendingOutgoing.length > 0 && (
          <div>
            <h3 className="font-medium text-[var(--foreground)] mb-2">Outgoing</h3>
            <ul className="space-y-2">
              {pendingOutgoing.map((req) => (
                <li key={req.id} className="flex justify-between items-center bg-[var(--item-bg-alpha)] p-3 rounded">
                  <span>{req.friend.email}</span>
                  <button
                    onClick={() => removeFriend(req.id)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm text-white"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Section 3: List of accepted friends */}
      <section className="bg-[var(--card-bg)] p-6 rounded-lg text-[var(--foreground)]">
        <h2 className="text-xl font-semibold border-b border-[var(--border)] pb-2 mb-4">Your Friends</h2>
        {loading ? (
          <p className="text-[var(--muted)]">Loading friends...</p>
        ) : acceptedFriends.length === 0 ? (
          <p className="text-[var(--muted)]">You have no friends added yet.</p>
        ) : (
          <ul className="space-y-2">
            {acceptedFriends.map((f) => (
              <li key={f.id} className="flex justify-between items-center bg-[var(--item-bg-alpha)] p-3 rounded">
                <span>{f.friend.email}</span>
                <button
                  onClick={() => removeFriend(f.id)}
                  className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm text-white"
                  title="Remove friend"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
