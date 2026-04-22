async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/chat/status');
    const data = await res.json();
    console.log("Status:", data);
  } catch (e) {
    console.error(e);
  }
}
test();
