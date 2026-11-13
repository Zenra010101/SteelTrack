import * as signalR from '@microsoft/signalr';
import { getStoredToken } from './session';

let connection: signalR.HubConnection | null = null;
let isStarting = false;

export interface RealtimeInventoryEvent {
  productId: string;
  branchId: string;
  newQuantity: number;
  timestamp: string;
}

export interface RealtimePriceEvent {
  productId: string;
  newPrice: number;
  timestamp: string;
}

export interface RealtimeSaleEvent {
  saleId: string;
  branch: string;
  totalAmount: number;
  cashierName: string;
  timestamp: string;
}

export interface RealtimeTransferEvent {
  transferNumber: string;
  sourceBranch: string;
  destinationBranch: string;
  weightInTons: number;
  timestamp: string;
}

export interface RealtimeApprovalEvent {
  type: string;
  title: string;
  message: string;
  transferId?: string;
  timestamp: string;
}

export function getSignalRConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/steeltrack', {
        accessTokenFactory: () => getStoredToken() || '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();
  }
  return connection;
}

export async function startSignalR(): Promise<signalR.HubConnection | null> {
  const hub = getSignalRConnection();
  if (hub.state === signalR.HubConnectionState.Connected) {
    return hub;
  }
  if (isStarting || hub.state === signalR.HubConnectionState.Connecting) {
    return hub;
  }

  isStarting = true;
  try {
    await hub.start();
    console.log('[SignalR] Connected to /hubs/steeltrack');
    return hub;
  } catch (err) {
    console.warn('[SignalR] Connection failed (server may be offline):', err);
    return null;
  } finally {
    isStarting = false;
  }
}

export async function joinBranchGroup(branchName: string): Promise<void> {
  const hub = getSignalRConnection();
  if (hub.state === signalR.HubConnectionState.Connected) {
    try {
      await hub.invoke('JoinBranchGroup', branchName);
    } catch (err) {
      console.warn('[SignalR] Failed to join branch group:', err);
    }
  }
}

export function onInventoryChanged(callback: (event: RealtimeInventoryEvent) => void): () => void {
  const hub = getSignalRConnection();
  hub.on('InventoryChanged', callback);
  return () => hub.off('InventoryChanged', callback);
}

export function onPriceChanged(callback: (event: RealtimePriceEvent) => void): () => void {
  const hub = getSignalRConnection();
  hub.on('PriceChanged', callback);
  return () => hub.off('PriceChanged', callback);
}

export function onSaleCompleted(callback: (event: RealtimeSaleEvent) => void): () => void {
  const hub = getSignalRConnection();
  hub.on('SaleCompleted', callback);
  return () => hub.off('SaleCompleted', callback);
}

export function onTransferRequested(callback: (event: RealtimeTransferEvent) => void): () => void {
  const hub = getSignalRConnection();
  hub.on('TransferRequested', callback);
  return () => hub.off('TransferRequested', callback);
}

export function onApprovalRequired(callback: (event: RealtimeApprovalEvent) => void): () => void {
  const hub = getSignalRConnection();
  hub.on('ApprovalRequired', callback);
  return () => hub.off('ApprovalRequired', callback);
}
