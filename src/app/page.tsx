
export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center h-[calc(100vh-60px)] text-center gap-6">
      <h1 className="text-3xl font-semibold text-sky-400">3D Microfluidic Channel Designer</h1>
      <p className="max-w-md text-slate-400">
        Web-based 3D editor for designing and generating microfluidic structures.
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="bg-sky-500 hover:bg-sky-600 text-white px-5 py-2 rounded-md"
        >
          Login
        </a>
        <a
          href="/register"
          className="border border-sky-500 text-sky-400 hover:bg-sky-500 hover:text-white px-5 py-2 rounded-md"
        >
          Register
        </a>
      </div>
    </main>
  );
}
