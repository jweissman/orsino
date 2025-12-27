export const never = <T>(_: never): T => {
  throw new Error(
    `Unexpected value: ${JSON.stringify(_)}`
  );
};
