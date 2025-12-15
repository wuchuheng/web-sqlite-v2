import Sqlite3Worker from "./worker?worker&inline";

export const start = async (): Promise<void> => {
  const sqlite3Worker = new Sqlite3Worker();
  sqlite3Worker.postMessage({
    type: "init",
  });

  sqlite3Worker.onmessage = (event) => {
    console.log(event.data);
  };

  // init sqlite3
  sqlite3Worker.postMessage({});

  console.log("worker init");
};

export default start;
