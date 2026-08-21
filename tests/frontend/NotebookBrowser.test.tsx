/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockInvoke = jest.fn();

jest.mock('@forge/bridge', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import NotebookBrowser from '../../src/frontend/components/NotebookBrowser';

const VENDOR_MESSAGE =
  "PageFlow's Microsoft connection is misconfigured. The cause is on the app vendor's side, " +
  'not with your Microsoft account. Please contact PageFlow support.';

const VENDOR_FAILURE = {
  authenticated: false,
  error: VENDOR_MESSAGE,
  errorKind: 'invalid-client-secret',
  errorCode: 'AADSTS7000215',
  errorOwner: 'vendor',
};

const ADMIN_FAILURE = {
  authenticated: false,
  error: 'Access to OneNote must be approved once by an administrator in your organisation.',
  errorKind: 'admin-consent-required',
  errorCode: 'AADSTS65001',
  errorOwner: 'tenant-admin',
};

function mockAuthStatus(status: object) {
  mockInvoke.mockImplementation((name: string) => {
    if (name === 'checkAuthStatus') return Promise.resolve(status);
    return Promise.resolve({ notebooks: [] });
  });
}

describe('NotebookBrowser bei Anbieter-Fehler', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockAuthStatus(VENDOR_FAILURE);
  });

  it('zeigt den Fehlerzustand statt der Verbinden-Einladung', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} />);

    expect(await screen.findByText('OneNote is currently unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText('Connect your Microsoft account to access OneNote notebooks.')
    ).not.toBeInTheDocument();
  });

  it('zeigt die klassifizierte Meldung und den Fehlercode als Referenz', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} />);

    expect(await screen.findByText(VENDOR_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText('Reference: AADSTS7000215')).toBeInTheDocument();
  });

  it('blendet den Verbinden-Button aus, weil ein erneuter Versuch nicht hilft', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} />);

    await screen.findByText('OneNote is currently unavailable');
    expect(
      screen.queryByRole('button', { name: 'Connect Microsoft Account' })
    ).not.toBeInTheDocument();
  });

  it('verweist auf den OAuth-freien lokalen Import', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} onSwitchTab={jest.fn()} />);

    expect(
      await screen.findByRole('button', { name: 'Go to Local OneNote import' })
    ).toBeInTheDocument();
  });

  it('wechselt per Klick tatsaechlich auf den Local-OneNote-Tab', async () => {
    const onSwitchTab = jest.fn();
    render(<NotebookBrowser onSelectionChange={jest.fn()} onSwitchTab={onSwitchTab} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Go to Local OneNote import' }));

    expect(onSwitchTab).toHaveBeenCalledWith('local-onenote');
  });
});

describe('NotebookBrowser bei fehlendem Admin-Consent', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockAuthStatus(ADMIN_FAILURE);
  });

  it('zeigt die Meldung, behaelt aber den Verbinden-Button fuer den zweiten Versuch', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} onSwitchTab={jest.fn()} />);

    expect(await screen.findByText(ADMIN_FAILURE.error)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Microsoft Account' })).toBeInTheDocument();
  });
});

describe('NotebookBrowser im Normalfall ohne Verbindung', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockAuthStatus({ authenticated: false });
  });

  it('zeigt die Einladung und keinen Fehlerzustand', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} onSwitchTab={jest.fn()} />);

    expect(
      await screen.findByText('Connect your Microsoft account to access OneNote notebooks.')
    ).toBeInTheDocument();
    expect(screen.queryByText('OneNote is currently unavailable')).not.toBeInTheDocument();
  });

  it('zeigt keinen Hinweis auf den lokalen Import', async () => {
    render(<NotebookBrowser onSelectionChange={jest.fn()} onSwitchTab={jest.fn()} />);

    await screen.findByText('Connect your Microsoft account to access OneNote notebooks.');
    expect(
      screen.queryByRole('button', { name: 'Go to Local OneNote import' })
    ).not.toBeInTheDocument();
  });
});
