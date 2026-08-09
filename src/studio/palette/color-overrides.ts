export function parseColorOverrides(input: string) {
  return Object.fromEntries(
    input
      .split(/\r?\n/)
      .map((line) => line.split("::").map((part) => part.trim()))
      .filter(
        (parts): parts is [string, string] =>
          parts.length >= 2 &&
          Boolean(parts[0]) &&
          /^#[0-9a-f]{6}$/i.test(parts[1]),
      )
      .map(([name, color]) => [name, color]),
  );
}
