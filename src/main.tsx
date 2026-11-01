import { createRoot } from "react-dom/client";
import { Accounts } from "./features/auth/Accounts";
import { App } from "./app/App";
import "./styles/style.css";

createRoot(document.getElementById("root")!).render(
  <Accounts>{(account) => <App key={account?.session.user.id ?? "local"} account={account} />}</Accounts>,
);
