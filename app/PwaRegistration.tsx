'use client';
import {useEffect} from 'react';
export default function PwaRegistration(){useEffect(()=>{if('serviceWorker' in navigator&&window.isSecureContext&&!location.pathname.startsWith('/admin'))navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{})},[]);return null}
