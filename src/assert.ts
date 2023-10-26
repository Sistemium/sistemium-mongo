export default function assert(test: any, message: string = 'Assertion failed') {
  if (!test) {
    throw new Error(message);
  }
}
