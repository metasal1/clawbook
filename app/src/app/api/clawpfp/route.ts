import { NextRequest, NextResponse } from "next/server";

const CLAWPFP_API = "https://api.clawpfp.com";

function solveChallenge(question: string, challengeType: string): string {
  try {
    if (challengeType === "arithmetic" || challengeType === "modular_math") {
      // Extract the math expression
      let expr = question.replace(/What is\s+/i, "").replace(/\?/g, "").trim();
      // Handle "mod" -> "%"
      expr = expr.replace(/\bmod\b/g, "%");
      // Handle "^" -> "**"
      expr = expr.replace(/\^/g, "**");
      // Evaluate safely with Function
      const result = new Function(`return (${expr})`)();
      return String(Math.round(result));
    }

    if (challengeType === "logic_sequence") {
      // Pattern: "What comes next: a, b, c, d, ?"
      const match = question.match(/:\s*([\d,\s]+),\s*\?/);
      if (match) {
        const nums = match[1].split(",").map((n) => parseInt(n.trim()));
        if (nums.length >= 2) {
          // Check ratio (geometric)
          const ratio = nums[1] / nums[0];
          const isGeometric = nums.every(
            (n, i) => i === 0 || Math.abs(n / nums[i - 1] - ratio) < 0.001
          );
          if (isGeometric) return String(Math.round(nums[nums.length - 1] * ratio));

          // Check difference (arithmetic)
          const diff = nums[1] - nums[0];
          const isArithmetic = nums.every(
            (n, i) => i === 0 || n - nums[i - 1] === diff
          );
          if (isArithmetic) return String(nums[nums.length - 1] + diff);
        }
      }
    }

    if (challengeType === "word_math") {
      const wordToNum: Record<string, number> = {
        zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
        seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
        thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
        eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
        fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
        hundred: 100, thousand: 1000, million: 1000000,
      };

      const words = question.toLowerCase().replace(/[?]/g, "").split(/\s+/);
      let total = 0, current = 0, op = "plus";

      for (const w of words) {
        if (w === "plus" || w === "minus" || w === "times") {
          if (op === "plus") total += current;
          else if (op === "minus") total -= current;
          else if (op === "times") total *= current;
          current = 0;
          op = w;
        } else if (wordToNum[w] !== undefined) {
          const val = wordToNum[w];
          if (val === 100) current = (current || 1) * 100;
          else if (val === 1000) current = (current || 1) * 1000;
          else if (val >= 20 && current > 0 && current < 10) current += val;
          else if (val < 10 && current >= 20) current += val;
          else current += val;
        }
      }
      if (op === "plus") total += current;
      else if (op === "minus") total -= current;
      else if (op === "times") total *= current;

      return String(total);
    }

    return "0";
  } catch {
    return "0";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wallet_address } = await req.json();

    if (!wallet_address) {
      return NextResponse.json({ error: "wallet_address required" }, { status: 400 });
    }

    // Step 1: Get challenge
    const challengeRes = await fetch(`${CLAWPFP_API}/challenge`);
    if (!challengeRes.ok) {
      return NextResponse.json({ error: "Failed to get challenge" }, { status: 502 });
    }
    const challenge = await challengeRes.json();

    // Step 2: Solve it
    const answer = solveChallenge(challenge.question, challenge.challenge_type);

    // Step 3: Mint
    const mintRes = await fetch(`${CLAWPFP_API}/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        answer,
        wallet_address,
      }),
    });

    const mintData = await mintRes.json();

    if (!mintRes.ok || !mintData.success) {
      const friendlyError = mintData.message === "Incorrect answer"
        ? "Challenge solver failed — please try again"
        : mintData.error === "internal_error"
        ? "ClawPFP service is temporarily unavailable — please try again in a moment"
        : mintData.message || mintData.error || "Mint failed — please try again";
      return NextResponse.json(
        { error: friendlyError, success: false },
        { status: 400 }
      );
    }

    // Generate the DiceBear avatar URL using the asset_id as seed
    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/png?seed=${mintData.asset_id}&size=256`;

    return NextResponse.json({
      success: true,
      asset_id: mintData.asset_id,
      tx_signature: mintData.tx_signature,
      avatar_url: avatarUrl,
      mint_index: mintData.mint_index,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
