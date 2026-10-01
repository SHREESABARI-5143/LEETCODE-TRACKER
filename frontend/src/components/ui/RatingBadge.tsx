import React from 'react';
import { getRatingTier } from '../../utils/helpers';

interface Props {
  rating: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function RatingBadge({ rating, showLabel = true, size = 'md' }: Props) {
  const numericRating = Math.round(Number(rating) || 0);
  const tier = getRatingTier(numericRating);
  const fontSize = size === 'sm' ? '0.7rem' : size === 'lg' ? '0.9rem' : '0.78rem';
  const ratingSize = size === 'sm' ? '0.85rem' : size === 'lg' ? '1.1rem' : '0.95rem';

  if (numericRating === 0) return (
    <span className="badge" style={{ background: 'rgba(75,85,99,0.2)', color: '#4b5563', fontSize }}>
      Unrated
    </span>
  );

  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: tier.color, fontWeight: 700, fontSize: ratingSize }}>{numericRating}</span>
      {showLabel && (
        <span className="badge" style={{ background: tier.bg, color: tier.color, fontSize }}>
          {tier.label}
        </span>
      )}
    </div>
  );
}
