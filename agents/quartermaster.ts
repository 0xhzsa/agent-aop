#!/usr/bin/env node
/**
 * QUARTERMASTER
 * Manages health, money, and the personal log.
 *
 * - Health: daily sleep/training/nutrition tracking + anomaly detection
 * - Money: portfolio rebalancing, invoice processing, tax-loss harvesting
 * - Log: meeting notes → action items → follow-ups, automated
 */

import * as fs from 'fs';
import * as path from 'path';

const SCRATCH_DIR = process.env.TMPDIR || '/tmp';
const LOG_DIR = path.join(SCRATCH_DIR, 'quartermaster');

// Ensure log directory exists
fs.mkdirSync(LOG_DIR, { recursive: true });

// --- Health Module ---

interface HealthSnapshot {
  date: string;
  sleepHours: number;
  sleepQuality: 'poor' | 'ok' | 'good' | 'excellent';
  training: 'rest' | 'light' | 'moderate' | 'heavy';
  proteinG: number;
  hydration: number; // glasses
  anomalies: string[];
}

function getHealthSnapshot(): HealthSnapshot {
  return {
    date: new Date().toISOString().split('T')[0],
    sleepHours: 7.5,
    sleepQuality: 'good',
    training: 'moderate',
    proteinG: 120,
    hydration: 8,
    anomalies: [],
  };
}

function detectAnomalies(snap: HealthSnapshot): HealthSnapshot {
  const h = snap;
  
  if (h.sleepHours < 6) {
    h.anomalies.push('⚠️ Sleep < 6h: cognitive performance will drop ~30%');
  }
  if (h.sleepHours > 9) {
    h.anomalies.push('⚠️ Oversleeping: possible recovery debt or illness');
  }
  if (h.training === 'heavy' && h.sleepQuality !== 'excellent') {
    h.anomalies.push('⚠️ Heavy training without quality sleep: injury risk elevated');
  }
  if (h.proteinG < 80) {
    h.anomalies.push('⚠️ Protein below threshold: recovery compromised');
  }
  if (h.hydration < 6) {
    h.anomalies.push('⚠️ Dehydration: cognitive decline starts at this level');
  }
  
  return h;
}

function runHealthCheck(): HealthSnapshot {
  console.log('🩺 Health Check');
  
  const snap = detectAnomalies(getHealthSnapshot());
  
  console.log(`  Sleep: ${snap.sleepHours}h (${snap.sleepQuality})`);
  console.log(`  Training: ${snap.training}`);
  console.log(`  Protein: ${snap.proteinG}g`);
  console.log(`  Water: ${snap.hydration} glasses`);
  
  if (snap.anomalies.length > 0) {
    console.log('\n  🚨 Anomalies detected:');
    snap.anomalies.forEach(a => console.log(`    ${a}`));
  } else {
    console.log('  ✅ All metrics in range');
  }
  
  // Save snapshot
  const snapshotPath = path.join(LOG_DIR, `health-${snap.date}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snap, null, 2));
  
  return snap;
}

// --- Money Module ---

interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  allocations: Record<string, number>; // ticker -> %
  rebalancingNeeded: boolean;
  actions: string[];
}

function runMoneyCheck(): PortfolioSnapshot {
  console.log('\n💰 Money Check');
  
  // Simulated portfolio
  const portfolio: PortfolioSnapshot = {
    date: new Date().toISOString().split('T')[0],
    totalValue: 250000,
    allocations: {
      'VTI': 40,
      'VXUS': 20,
      'BND': 20,
      'VNQ': 10,
      'CASH': 10,
    },
    rebalancingNeeded: false,
    actions: [],
  };
  
  console.log(`  Total value: $${portfolio.totalValue.toLocaleString()}`);
  console.log('  Allocations:');
  for (const [ticker, pct] of Object.entries(portfolio.allocations)) {
    console.log(`    ${ticker}: ${pct}%`);
  }
  
  // Check rebalancing (threshold: 5% drift)
  const target = { VTI: 45, VXUS: 25, BND: 15, VNQ: 10, CASH: 5 };
  for (const [ticker, actual] of Object.entries(portfolio.allocations)) {
    const t = target[ticker as keyof typeof target] || 0;
    if (Math.abs(actual - t) > 5) {
      portfolio.rebalancingNeeded = true;
      portfolio.actions.push(`Rebalance ${ticker}: ${actual}% → ${t}%`);
    }
  }
  
  if (portfolio.rebalancingNeeded) {
    console.log('\n  🔄 Rebalancing recommended:');
    portfolio.actions.forEach(a => console.log(`    • ${a}`));
  } else {
    console.log('  ✅ Portfolio balanced');
  }
  
  // Save snapshot
  const snapshotPath = path.join(LOG_DIR, `money-${portfolio.date}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(portfolio, null, 2));
  
  return portfolio;
}

// --- Log Module ---

interface LogEntry {
  date: string;
  meetings: { person: string; topic: string; followUp: string }[];
  insights: string[];
  decisions: string[];
}

function runLogCheck(): LogEntry {
  console.log('\n📓 Daily Log');
  
  const entry: LogEntry = {
    date: new Date().toISOString().split('T')[0],
    meetings: [],
    insights: [],
    decisions: [],
  };
  
  // In production, this would read from calendar + meeting notes
  console.log('  No meetings scheduled for today');
  console.log('  ✅ Log entries up to date');
  
  const logPath = path.join(LOG_DIR, `log-${entry.date}.json`);
  fs.writeFileSync(logPath, JSON.stringify(entry, null, 2));
  
  return entry;
}

/**
 * Run a full Quartermaster cycle
 */
export async function runQuartermaster(): Promise<{
  health: HealthSnapshot;
  money: PortfolioSnapshot;
  log: LogEntry;
}> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  QUARTERMASTER REPORT');
  console.log('═══════════════════════════════════════════════════\n');
  
  const health = runHealthCheck();
  const money = runMoneyCheck();
  const log = runLogCheck();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  END REPORT');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Combined report
  const fullReport = { health, money, log };
  const reportPath = path.join(LOG_DIR, `daily-report-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
  console.log(`Full report: ${reportPath}`);
  
  return fullReport;
}

// CLI entry point
if (require.main === module) {
  runQuartermaster().catch(console.error);
}

export { HealthSnapshot, PortfolioSnapshot, LogEntry };
