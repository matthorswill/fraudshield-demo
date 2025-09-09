"use client";
import Home from '../pages/index';

export default function ClientHome({ data, queryInit, error }){
  return <Home data={data} queryInit={queryInit||{}} error={error||null} />;
}

