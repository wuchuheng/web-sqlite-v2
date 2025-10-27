import open from "@wuchuheng/web-sqlite";
export function setupCounter(element: HTMLButtonElement) {
  open("counter.db").then(() => {});
  let counter = 0;
  const setCounter = (count: number) => {
    counter = count;
    element.innerHTML = `count is ${counter}`;
  };
  element.addEventListener("click", () => setCounter(counter + 1));
  setCounter(0);
}
