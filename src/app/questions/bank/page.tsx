"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function QuestionBankPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/questions/workshop");
  }, [router]);
  return null;
}
