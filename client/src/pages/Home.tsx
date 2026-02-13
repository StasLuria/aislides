/**
 * Home Page — Redirects to Chat (chat-first approach)
 */

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/chat", { replace: true });
  }, [navigate]);

  return null;
}
