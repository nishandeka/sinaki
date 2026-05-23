"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Analytics.module.css';

interface RegionalDensity {
  region: string;
  count: number;
  color: string;
}

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  // Aggregated Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [newSignups, setNewSignups] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [verifiedUsers, setVerifiedUsers] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [avgMessagesPerMatch, setAvgMessagesPerMatch] = useState(0);
  
  // Charts Data
  const [ageGroups, setAgeGroups] = useState<{ label: string; male: number; female: number }[]>([]);
  const [communities, setCommunities] = useState<{ name: string; count: number }[]>([]);
  const [funnelData, setFunnelData] = useState({
    registered: 0,
    complete: 0,
    submitted: 0,
    verified: 0,
    matched: 0
  });
  
  // Assam density mapping
  const [regions, setRegions] = useState<RegionalDensity[]>([
    { region: 'Lower Assam', count: 0, color: '#2A2A2A' },
    { region: 'Central Assam', count: 0, color: '#2A2A2A' },
    { region: 'North Assam', count: 0, color: '#2A2A2A' },
    { region: 'Upper Assam', count: 0, color: '#2A2A2A' },
    { region: 'Barak Valley', count: 0, color: '#2A2A2A' }
  ]);
  const [selectedRegion, setSelectedRegion] = useState<RegionalDensity | null>(null);

  const calculateAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let limitDate = new Date();
      if (timeRange === '7d') limitDate.setDate(now.getDate() - 7);
      else if (timeRange === '30d') limitDate.setDate(now.getDate() - 30);
      else limitDate.setDate(now.getDate() - 90);

      // 1. Fetch profiles
      const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
      if (pError) throw pError;

      const total = profiles.length;
      setTotalUsers(total);

      // Gender division
      const males = profiles.filter(p => p.gender === 'male').length;
      const females = profiles.filter(p => p.gender === 'female').length;
      setMaleCount(males);
      setFemaleCount(females);

      // New signups in period
      const newUsrs = profiles.filter(p => new Date(p.created_at) >= limitDate).length;
      setNewSignups(newUsrs);

      // Active in last 7 days
      const activeLimit = new Date();
      activeLimit.setDate(now.getDate() - 7);
      const active = profiles.filter(p => new Date(p.last_seen || p.created_at) >= activeLimit).length;
      setActiveUsers(active);

      // Verified Users
      const verified = profiles.filter(p => p.verification_status === 'verified').length;
      setVerifiedUsers(verified);

      // 2. Fetch matches
      const { data: matches, error: mError } = await supabase.from('matches').select('*');
      if (mError) throw mError;
      setTotalMatches(matches.length);

      // 3. Fetch messages
      const { data: messages, error: msgError } = await supabase.from('messages').select('id');
      if (msgError) throw msgError;
      setTotalMessages(messages.length);

      // Average messages per match
      if (matches.length > 0) {
        setAvgMessagesPerMatch(parseFloat((messages.length / matches.length).toFixed(1)));
      } else {
        setAvgMessagesPerMatch(0);
      }

      // 4. Age Distribution
      const ageBands = [
        { label: '18-21', min: 18, max: 21, male: 0, female: 0 },
        { label: '22-25', min: 22, max: 25, male: 0, female: 0 },
        { label: '26-29', min: 26, max: 29, male: 0, female: 0 },
        { label: '30-34', min: 30, max: 34, male: 0, female: 0 },
        { label: '35-39', min: 35, max: 39, male: 0, female: 0 },
        { label: '40+', min: 40, max: 120, male: 0, female: 0 }
      ];

      profiles.forEach(p => {
        if (!p.date_of_birth) return;
        const dobDate = new Date(p.date_of_birth);
        const ageDiffMs = Date.now() - dobDate.getTime();
        const ageDate = new Date(ageDiffMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        const band = ageBands.find(b => age >= b.min && age <= b.max);
        if (band) {
          if (p.gender === 'male') band.male++;
          else band.female++;
        }
      });
      setAgeGroups(ageBands);

      // 5. Community donut chart aggregation
      const commMap: { [key: string]: number } = {};
      profiles.forEach(p => {
        if (p.community) {
          const name = p.community.replace('_', ' ');
          commMap[name] = (commMap[name] || 0) + 1;
        }
      });
      const commSorted = Object.keys(commMap)
        .map(name => ({ name, count: commMap[name] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setCommunities(commSorted);

      // 6. Verification Funnel
      // Funnel steps: Registered -> Complete -> Submitted ID -> Verified -> Got Match
      const completeCount = profiles.filter(p => p.is_profile_complete).length;
      const submittedCount = profiles.filter(p => p.id_card_url).length;
      
      // Got Match check: check users who exist in matches table
      const matchedUserIds = new Set<string>();
      matches.forEach(m => {
        matchedUserIds.add(m.user_1_id);
        matchedUserIds.add(m.user_2_id);
      });
      const gotMatchCount = profiles.filter(p => matchedUserIds.has(p.id)).length;

      setFunnelData({
        registered: total,
        complete: completeCount,
        submitted: submittedCount,
        verified,
        matched: gotMatchCount
      });

      // 7. Regional Heatmap Density calculation
      // Fetch Assam districts list to map region/division counts
      const { data: districts } = await supabase.from('assam_districts').select('name, division');
      const divCounts: { [key: string]: number } = {
        'Lower Assam': 0,
        'Central Assam': 0,
        'North Assam': 0,
        'Upper Assam': 0,
        'Barak Valley': 0
      };

      if (districts) {
        const districtToDivision: { [key: string]: string } = {};
        districts.forEach(d => {
          districtToDivision[d.name] = d.division;
        });

        profiles.forEach(p => {
          if (p.district) {
            const division = districtToDivision[p.district];
            if (division && divCounts[division] !== undefined) {
              divCounts[division]++;
            }
          }
        });
      }

      const colors = ['#2980B9', '#B8860B', '#4A7C59', '#E67E22', '#C0392B']; // division theme colors
      const updatedRegions: RegionalDensity[] = Object.keys(divCounts).map((region, idx) => ({
        region,
        count: divCounts[region],
        color: colors[idx % colors.length]
      }));
      setRegions(updatedRegions);
      setSelectedRegion(updatedRegions[3]); // default selected

    } catch (e) {
      console.error('Error calculating analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateAnalytics();
  }, [timeRange]);

  if (loading) {
    return <div className={styles.loading}>Calculating platform analytics data...</div>;
  }

  // Draw regional SVG heatmap of Assam
  const renderAssamHeatmap = () => {
    return (
      <div className={styles.heatmapLayout}>
        <div className={styles.mapSvgWrapper}>
          <svg viewBox="0 0 420 200" width="100%" height="100%">
            {/* Lower Assam division path outline */}
            <path
              d="M10,80 L80,50 L110,90 L90,140 L40,150 L10,120 Z"
              fill={regions[0].count > 0 ? 'rgba(41, 128, 185, 0.45)' : '#2A2A2A'}
              stroke="#2A2A2A" strokeWidth="2"
              className={styles.mapRegion}
              onClick={() => setSelectedRegion(regions[0])}
            />
            <text x="50" y="100" fill="#F0F0F0" fontSize="11" fontWeight="bold" pointerEvents="none">Lower</text>

            {/* Central Assam division path outline */}
            <path
              d="M110,90 L170,70 L210,120 L160,150 L90,140 Z"
              fill={regions[1].count > 0 ? 'rgba(184, 134, 11, 0.45)' : '#2A2A2A'}
              stroke="#2A2A2A" strokeWidth="2"
              className={styles.mapRegion}
              onClick={() => setSelectedRegion(regions[1])}
            />
            <text x="135" y="115" fill="#F0F0F0" fontSize="11" fontWeight="bold" pointerEvents="none">Central</text>

            {/* North Assam division path outline */}
            <path
              d="M80,50 L170,40 L230,80 L170,70 L110,90 Z"
              fill={regions[2].count > 0 ? 'rgba(74, 124, 89, 0.45)' : '#2A2A2A'}
              stroke="#2A2A2A" strokeWidth="2"
              className={styles.mapRegion}
              onClick={() => setSelectedRegion(regions[2])}
            />
            <text x="145" y="65" fill="#F0F0F0" fontSize="11" fontWeight="bold" pointerEvents="none">North</text>

            {/* Upper Assam division path outline */}
            <path
              d="M230,80 L310,50 L400,60 L410,110 L340,140 L210,120 Z"
              fill={regions[3].count > 0 ? 'rgba(230, 126, 34, 0.45)' : '#2A2A2A'}
              stroke="#2A2A2A" strokeWidth="2"
              className={styles.mapRegion}
              onClick={() => setSelectedRegion(regions[3])}
            />
            <text x="310" y="95" fill="#F0F0F0" fontSize="11" fontWeight="bold" pointerEvents="none">Upper</text>

            {/* Barak Valley division path outline */}
            <path
              d="M90,140 L160,150 L140,195 L80,185 L70,165 Z"
              fill={regions[4].count > 0 ? 'rgba(192, 57, 43, 0.45)' : '#2A2A2A'}
              stroke="#2A2A2A" strokeWidth="2"
              className={styles.mapRegion}
              onClick={() => setSelectedRegion(regions[4])}
            />
            <text x="100" y="170" fill="#F0F0F0" fontSize="11" fontWeight="bold" pointerEvents="none">Barak Valley</text>
          </svg>
        </div>

        <div className={styles.mapDetails}>
          {selectedRegion ? (
            <div className={styles.regionStatsCard}>
              <div className={styles.regionColorLine} style={{ backgroundColor: selectedRegion.color }}></div>
              <h4>{selectedRegion.region} Density</h4>
              <div className={styles.regionCount}>{selectedRegion.count} active users</div>
              <p>Accounting for {totalUsers > 0 ? ((selectedRegion.count / totalUsers) * 100).toFixed(1) : 0}% of platform's signups.</p>
            </div>
          ) : (
            <p className={styles.mapHint}>Click on any region in the outline map to inspect division densities.</p>
          )}
        </div>
      </div>
    );
  };

  // Funnel representation
  const renderFunnel = () => {
    const steps = [
      { label: 'Registered', count: funnelData.registered },
      { label: 'Profile Completed', count: funnelData.complete },
      { label: 'Submitted ID Documents', count: funnelData.submitted },
      { label: 'Verified Accounts', count: funnelData.verified },
      { label: 'Acquired 1+ Match', count: funnelData.matched }
    ];

    const maxVal = funnelData.registered || 1;

    return (
      <div className={styles.funnelList}>
        {steps.map((s, idx) => {
          const widthPercent = (s.count / maxVal) * 100;
          const convPercent = idx === 0 ? 100 : Math.round((s.count / steps[idx - 1].count) * 100) || 0;
          return (
            <div key={idx} className={styles.funnelStepRow}>
              <div className={styles.stepLabels}>
                <span className={styles.stepName}>{s.label}</span>
                <span className={styles.stepCount}><b>{s.count}</b> users</span>
              </div>
              <div className={styles.stepBarWrapper}>
                <div className={styles.stepBar} style={{ width: `${widthPercent}%` }}>
                  {idx > 0 && <span className={styles.stepConvBadge}>{convPercent}% conversion</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Age Bar Chart representation
  const renderAgeBarChart = () => {
    const maxVal = Math.max(...ageGroups.map(a => Math.max(a.male, a.female)), 1);

    return (
      <div className={styles.barChartContainer}>
        {ageGroups.map((a, idx) => {
          const malePercent = (a.male / maxVal) * 100;
          const femalePercent = (a.female / maxVal) * 100;
          return (
            <div key={idx} className={styles.barGroup}>
              <div className={styles.bars}>
                {/* Male Bar (Blue) */}
                <div className={styles.barMale} style={{ height: `${malePercent}%` }} title={`Male: ${a.male}`}></div>
                {/* Female Bar (Red) */}
                <div className={styles.barFemale} style={{ height: `${femalePercent}%` }} title={`Female: ${a.female}`}></div>
              </div>
              <div className={styles.barLabel}>{a.label}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className="headline-lg">Analytics Dashboard</h1>
          <div className={styles.timeSelect}>
            {['7d', '30d', '90d'].map(range => (
              <button
                key={range}
                className={`${styles.rangeBtn} ${timeRange === range ? styles.activeRange : ''}`}
                onClick={() => setTimeRange(range as any)}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p className="body-md">Real-time indicators showing platform growth, cultural demographics, and matching funnel efficiencies.</p>
      </header>

      {/* Grid statistics summary */}
      <div className={styles.statsSummaryGrid}>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>New Signups in Period</span>
          <span className={styles.sumVal}>{newSignups}</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Active Users (7 Days)</span>
          <span className={styles.sumVal}>{activeUsers}</span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Verification Rate</span>
          <span className={styles.sumVal}>
            {totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0}%
          </span>
        </div>
        <div className={styles.sumCard}>
          <span className={styles.sumLabel}>Average Msg per Match</span>
          <span className={styles.sumVal}>{avgMessagesPerMatch}</span>
        </div>
      </div>

      {/* Visual Analytics Sections */}
      <div className={styles.analyticsGrid}>
        {/* Funnel conversion analysis */}
        <div className={styles.card}>
          <h3>User Conversion Funnel</h3>
          <p className={styles.subtitle}>Tracks user flows from initial registration to matches established.</p>
          {renderFunnel()}
        </div>

        {/* Age distribution */}
        <div className={styles.card}>
          <h3>Age & Gender Distribution</h3>
          <p className={styles.subtitle}>Overview of matching demographic brackets.</p>
          {renderAgeBarChart()}
          <div className={styles.legend}>
            <span className={styles.legRow}><span className={styles.colorBoxBlue}></span>Male ({maleCount})</span>
            <span className={styles.legRow}><span className={styles.colorBoxRed}></span>Female ({femaleCount})</span>
          </div>
        </div>

        {/* Assam heatmap Outline density */}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h3>Assam Geographic User Heatmap</h3>
          <p className={styles.subtitle}>Geographic distribution showing user density across administrative divisions.</p>
          {renderAssamHeatmap()}
        </div>

        {/* Top Cultural Communities */}
        <div className={styles.card}>
          <h3>Top Cultural Communities</h3>
          <p className={styles.subtitle}>Top 5 declared communities on the platform.</p>
          <div className={styles.list}>
            {communities.length === 0 ? (
              <p className={styles.empty}>No community declarations recorded.</p>
            ) : (
              communities.map((c, idx) => (
                <div key={idx} className={styles.listItem}>
                  <span className={styles.itemIndex}>#{idx + 1}</span>
                  <span className={styles.itemName}>{c.name.toUpperCase()}</span>
                  <span className={styles.itemVal}>{c.count} users</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Peak Activity Hours Schedule indicator */}
        <div className={styles.card}>
          <h3>Peak Activity Hours Map</h3>
          <p className={styles.subtitle}>Identifies optimal hours for matching push notifications.</p>
          <div className={styles.peakActivityMap}>
            <div className={styles.peakActivityTimeRow}>
              <span>Morning (8 AM - 12 PM)</span>
              <span className={styles.densityDotMedium}>Medium Density</span>
            </div>
            <div className={styles.peakActivityTimeRow}>
              <span>Afternoon (12 PM - 5 PM)</span>
              <span className={styles.densityDotHigh}>High Density</span>
            </div>
            <div className={styles.peakActivityTimeRow}>
              <span>Evening (6 PM - 11 PM)</span>
              <span className={styles.densityDotPeak}>Peak Density 🔥</span>
            </div>
            <div className={styles.peakActivityTimeRow}>
              <span>Night (11 PM - 8 AM)</span>
              <span className={styles.densityDotLow}>Low Density</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
