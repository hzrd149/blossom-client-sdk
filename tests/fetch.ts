import createFetchMock from "vitest-fetch-mock";
import { beforeEach, vi } from "vitest";

const fetchMock = createFetchMock(vi);

// sets globalThis.fetch and globalThis.fetchMock to our mocked version
fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
});

export default fetchMock;
