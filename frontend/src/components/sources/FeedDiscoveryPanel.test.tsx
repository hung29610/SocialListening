/**
 * Feed discovery + OPML import UI.
 *
 * Asserts the honest-state rules: nothing is claimed as connected, blocked feeds
 * cannot be selected, the empty state is explicit, and per-feed import outcomes
 * are rendered from the backend response rather than assumed.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import FeedDiscoveryPanel from './FeedDiscoveryPanel';

const post = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
}));

vi.mock('react-hot-toast', () => {
  const toast: any = vi.fn();
  toast.success = vi.fn();
  toast.error = vi.fn();
  return { __esModule: true, default: toast, toast };
});

function renderPanel(onImported?: () => void) {
  return render(
    <LanguageProvider>
      <FeedDiscoveryPanel onImported={onImported} />
    </LanguageProvider>,
  );
}

async function discover(url: string) {
  const input = screen.getByLabelText(/website address|địa chỉ website/i);
  fireEvent.change(input, { target: { value: url } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /find feeds|tìm feed/i }));
  });
}

beforeEach(() => {
  post.mockReset();
  window.localStorage.setItem('app_language', 'en');
});

describe('FeedDiscoveryPanel — website discovery', () => {
  it('lists discovered feeds and preselects the available ones', async () => {
    post.mockResolvedValueOnce({
      data: {
        ok: true,
        page_title: 'Example News',
        input_was_feed: false,
        feeds: [
          { url: 'https://example.com/rss.xml', title: 'Main feed', kind: 'rss', status: 'available' },
          { url: 'https://example.com/atom.xml', title: null, kind: 'atom', status: 'available' },
        ],
      },
    });

    renderPanel();
    await discover('https://example.com');

    expect(post).toHaveBeenCalledWith('/api/sources/discover-feeds', { url: 'https://example.com' });
    await screen.findByText('Main feed');
    expect(screen.getByText('Example News')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every(box => box.checked)).toBe(true);
  });

  it('shows an explicit empty state when the site advertises no feed', async () => {
    post.mockResolvedValueOnce({ data: { ok: true, page_title: 'Nothing here', feeds: [] } });

    renderPanel();
    await discover('https://example.com');

    expect(await screen.findByText(/No RSS\/Atom feed found/i)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('renders a blocked candidate as unselectable with a localized reason', async () => {
    post.mockResolvedValueOnce({
      data: {
        ok: true,
        feeds: [
          {
            url: 'http://169.254.169.254/latest/meta-data/',
            title: 'Internal',
            status: 'blocked',
            error_code: 'blocked_target',
          },
          { url: 'https://example.com/rss.xml', title: 'Good', status: 'available' },
        ],
      },
    });

    renderPanel();
    await discover('https://example.com');

    await screen.findByText('Internal');
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const blockedBox = checkboxes[0];
    expect(blockedBox.disabled).toBe(true);
    expect(blockedBox.checked).toBe(false);
    expect(screen.getByText(/points to an internal address/i)).toBeTruthy();
  });

  it('surfaces a backend error code as a localized message', async () => {
    post.mockResolvedValueOnce({ data: { ok: false, error_code: 'blocked_target', feeds: [] } });

    renderPanel();
    await discover('http://127.0.0.1');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/internal address/i);
  });

  it('flags when the submitted URL is itself a feed', async () => {
    post.mockResolvedValueOnce({
      data: {
        ok: true,
        input_was_feed: true,
        feeds: [{ url: 'https://example.com/rss', title: 'Direct', status: 'available' }],
      },
    });

    renderPanel();
    await discover('https://example.com/rss');

    expect(await screen.findByText(/is itself a feed/i)).toBeTruthy();
  });
});

describe('FeedDiscoveryPanel — import', () => {
  async function discoverTwo() {
    post.mockResolvedValueOnce({
      data: {
        ok: true,
        feeds: [
          { url: 'https://a.example/rss', title: 'A', status: 'available' },
          { url: 'https://b.example/rss', title: 'B', status: 'available' },
        ],
      },
    });
    renderPanel();
    await discover('https://example.com');
    await screen.findByText('A');
  }

  it('sends only the selected feeds and never activates them', async () => {
    await discoverTwo();

    // Deselect the second feed.
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[1]);

    post.mockResolvedValueOnce({
      data: {
        summary: { created: 1, duplicate: 0, blocked: 0, invalid: 0, failed: 0, total: 1 },
        results: [{ url: 'https://a.example/rss', name: 'A', status: 'created', source_id: 7 }],
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add 1 selected feed/i }));
    });

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const [, payload] = post.mock.calls[1];
    expect(payload.activate).toBe(false);
    expect(payload.feeds).toEqual([{ url: 'https://a.example/rss', name: 'A', kind: undefined }]);
  });

  it('renders honest per-feed outcomes including failures', async () => {
    await discoverTwo();

    post.mockResolvedValueOnce({
      data: {
        summary: { created: 1, duplicate: 0, blocked: 0, invalid: 1, failed: 0, total: 2 },
        results: [
          { url: 'https://a.example/rss', name: 'A', status: 'created' },
          { url: 'https://b.example/rss', name: 'B', status: 'invalid', error_code: 'invalid_xml' },
        ],
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add 2 selected feed/i }));
    });

    expect(await screen.findByText(/Per-feed import result/i)).toBeTruthy();
    expect(screen.getByText('Added')).toBeTruthy();
    expect(screen.getByText('Invalid')).toBeTruthy();
    expect(screen.getByText(/not valid XML\/RSS/i)).toBeTruthy();
  });

  it('calls onImported only when something was actually created', async () => {
    const onImported = vi.fn();
    post.mockResolvedValueOnce({
      data: { ok: true, feeds: [{ url: 'https://a.example/rss', title: 'A', status: 'available' }] },
    });
    renderPanel(onImported);
    await discover('https://example.com');
    await screen.findByText('A');

    post.mockResolvedValueOnce({
      data: {
        summary: { created: 0, duplicate: 1, blocked: 0, invalid: 0, failed: 0, total: 1 },
        results: [{ url: 'https://a.example/rss', name: 'A', status: 'duplicate' }],
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add 1 selected feed/i }));
    });

    await screen.findByText(/Per-feed import result/i);
    expect(onImported).not.toHaveBeenCalled();
  });
});

describe('FeedDiscoveryPanel — OPML', () => {
  it('previews an uploaded OPML file and marks blocked entries', async () => {
    post.mockResolvedValueOnce({
      data: {
        ok: true,
        title: 'My subscriptions',
        feeds: [
          { url: 'https://a.example/rss', title: 'A', status: 'available' },
          { url: 'file:///etc/passwd', title: 'Local', status: 'blocked', error_code: 'unsupported_scheme' },
        ],
      },
    });

    renderPanel();
    const file = new File(['<opml><body/></opml>'], 'subs.opml', { type: 'text/xml' });
    const input = screen.getByLabelText(/OPML file|Tệp OPML/i) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await screen.findByText('My subscriptions');
    expect(post.mock.calls[0][0]).toBe('/api/sources/opml/preview');
    expect(screen.getByText('Local')).toBeTruthy();
    expect(screen.getByText(/Only URLs starting with http/i)).toBeTruthy();
  });

  it('shows a localized message when the OPML file is rejected', async () => {
    post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { detail: 'Tệp OPML chứa khai báo DOCTYPE nên bị từ chối.', error_code: 'opml_doctype_forbidden' },
        headers: { 'x-error-code': 'opml_doctype_forbidden' },
      },
    });

    renderPanel();
    const file = new File(['<!DOCTYPE opml>'], 'bad.opml', { type: 'text/xml' });
    const input = screen.getByLabelText(/OPML file|Tệp OPML/i) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/DOCTYPE/i);
    // English UI must not receive the Vietnamese detail.
    expect(alert.textContent).not.toMatch(/Tệp/);
  });
});
