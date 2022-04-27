import type { GetStaticProps, InferGetStaticPropsType, NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.scss'
import Map, { Layer, LayerProps, MapRef, Source } from 'react-map-gl';
import { useEffect, useRef, useState } from 'react';
import { Vehicle } from '../types';
import { VehicleBasicDetails } from './api/vehicles';
import mapboxgl, { MapLayerMouseEvent } from 'mapbox-gl';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { VehicleDetails } from './api/vehicleDetails';

export const getStaticProps:GetStaticProps = async (context) => {
  const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN
  return {props:{mapboxAccessToken}}
}

type filter = (v:Vehicle)=>boolean

const f1:filter = ()=>true

const busLayerStyle:LayerProps = {
  id: 'buses',
  type: 'symbol',
  paint:{
    "text-color": ['get', 'color']
  },
  layout:{
    'icon-image': 'bus',
  // get the title name from the source's "title" property
  'text-field': ['get', 'line'],
  'text-font': [
    'DIN Pro Bold',
    'Open Sans Semibold',
    'Arial Unicode MS Bold'
  ],
  'text-offset': [0, .85],
  'text-anchor': 'top',
  "icon-anchor": 'center',
  "text-size": 10
  }
}

const tramLayerStyle:LayerProps = {
  id: 'trams',
  type: 'symbol',
  paint:{
    "text-color": ['get', 'color'],
  },
  layout:{
    'icon-image': 'rail-light',
  // get the title name from the source's "title" property
  'text-field': ['get', 'line'],
  'text-font': [
    'DIN Pro Bold',
    'Open Sans Semibold',
    'Arial Unicode MS Bold'
  ],
  'text-offset': [0, .75],
  'text-anchor': 'top',
  "icon-anchor": 'center',
  "text-size": 10
  }
}

const VehicleBasicDetails = ({basicInfo, currentInfo, selectVehicle, selected}:{
  basicInfo:VehicleBasicDetails,
  currentInfo:Vehicle,
  selectVehicle:({type,vehicleNumber}:{type:'bus'|'tram',vehicleNumber:string})=>any,
  selected:boolean
  })=>{
  return <li
  className={styles.leftBarCard+' '+styles.vehicleCard}
  onClick={()=>{selectVehicle({type:basicInfo.type,vehicleNumber:basicInfo.vehicleNumber})}}
  style={selected?{boxShadow:`0 0 3px 2px ${basicInfo.type=='bus'?'#909':'#f00'}, inset 0 0 3px 2px ${basicInfo.type=='bus'?'#909':'#f00'}`}:undefined}
  >
    <span style={{
      backgroundColor: basicInfo.type=='bus'?'#909':'#f00'
    }}>{basicInfo.type}</span>
    <h1>{currentInfo.line}</h1>
    <ul>
      <li>model: {basicInfo.make} {basicInfo.model}</li>
      <li>vehicle number: {currentInfo.vehicleNumbers.join('+')}</li>
      <li>depot: {basicInfo.depot}</li>  
      <li>carrier: {basicInfo.carrier}</li>  
    </ul>
  </li>
}

const getBasicDetails = async (limit:number, offset:number, ids:string[], options?:Partial<VehicleBasicDetails>) => {
  const l = limit.toString()
  const o = offset.toString()
  const idsString = ids.join(',')
  const params = new URLSearchParams({...options, limit: l, offset: o, ids: idsString});
  const ret = (await (await fetch(`/api/vehicles/?${params}`)).json()) as VehicleBasicDetails[]
  return ret
}

const Home: NextPage = ({mapboxAccessToken}:InferGetStaticPropsType<typeof getStaticProps>) => {
  const [filterInputs, setFilterInputs] = useState({line:'',vehicleNumber:'',make:'',model:'',type:''})
  const [vehicles, setVehicles] = useState([] as Vehicle[])
  const [filter, setFilter] = useState({filter:(a:Vehicle)=>true as boolean})
  const [vehiclesWithBasicDetails, setVehiclesWithBasicDetails] = useState([] as VehicleBasicDetails[])
  const [indexes, setIndexes] = useState([] as {id:string,type:'bus'|'tram'}[])
  const [vehiclesToShowOnLeft, setVehiclesToShowOnLeft] = useState([] as Vehicle[])
  const [leftBarVisible, setLeftBarVisible] = useState(true)
  const [selectedVehicle, selectVehicle] = useState(null as {vehicleNumber:string,type:'bus'|'tram'}|null)
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState(null as VehicleDetails|null)
  const [detailsExtended, setDetailsExtended] = useState(true)

  const mapRef = useRef<MapRef>(null)

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    getBasicDetails(10000, 0, [],{}).then(setVehiclesWithBasicDetails)
    const refreshData = async()=>{
      const newVehicles = await (await fetch('/api/geo')).json() as Vehicle[]
      setVehicles([...newVehicles])
    }
    refreshData()
    setInterval(refreshData,10000)
  },[])

  useEffect(()=>{
    setSelectedVehicleDetails(null)
    if(!selectedVehicle) return;
    (async()=>{
      const params = new URLSearchParams(selectedVehicle).toString();
      const data = await (await fetch('/api/vehicleDetails?'+params)).json()
      setSelectedVehicleDetails(data)
    })()
    mapRef.current?.flyTo({center:vehicles.find(v=>v.vehicleNumbers[0]==selectedVehicle.vehicleNumber&&v.type==selectedVehicle.type)?.geo, zoom: 15})
  },[selectedVehicle])

  const setFilterInput = (key:string, value:any)=>{
    console.log(key, value)
    setFilterInputs({...filterInputs, [key]:value})
  }

  const applyFilter = ()=>{
    setFilter({filter:
    (a:Vehicle)=>{
      const details = vehiclesWithBasicDetails.find(v=>v.vehicleNumber==a.vehicleNumbers[0]&&v.type==a.type)
      if(filterInputs.make && (filterInputs.make.toLowerCase() != details?.make.toLowerCase())) return false
      if(filterInputs.model && (filterInputs.model.toLowerCase() != details?.model.toLowerCase())) return false
      if(filterInputs.line && (filterInputs.line.toLowerCase() != a.line.toLowerCase())) return false
      if(filterInputs.vehicleNumber && (filterInputs.vehicleNumber.toLowerCase() != a.vehicleNumbers[0].toLowerCase())) return false
      if(filterInputs.type && (filterInputs.type != a.type)) return false
      return true
    }
    })
  }

  useEffect(()=>{
    console.log(vehiclesWithBasicDetails)
  },[vehiclesWithBasicDetails])

  const updateVisibleVehicles = (map:mapboxgl.Map) =>{
    //@ts-expect-error
    setIndexes(map.queryRenderedFeatures({layers:['trams', 'buses']}).map(layer=>{return{id:layer.id,type:layer.properties.type}}))
  }

  useEffect(()=>{
    setVehiclesToShowOnLeft(
      vehicles
      .filter(v=>indexes.findIndex(i=>(v.vehicleNumbers[0]==i.id)&&(v.type==i.type))!==-1)
      .slice(0,100))
  },[vehicles,vehiclesWithBasicDetails,indexes, filter])

  const mapClick=(e:MapLayerMouseEvent)=>{
    if(!e.features) return
    e.features[0].id
    selectVehicle({
      type: e.features[0].layer.id=='buses'?'bus':'tram',
      vehicleNumber: e.features[0].id as string
    })
  }
  const filteredVehicles = vehicles.filter(filter.filter)
  mapRef.current?.on('mouseup', ['trams', 'buses'], mapClick)

  return (
    <div className={styles.container}>
      <Head>
        <title>WTP Vehicle map</title>
        <meta name="description" content="A vehicle tracker by Szedann" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.leftBar}>
        <div className={`${styles.leftBarCard} ${styles.expandHide}`}>
          <h2>
            {filteredVehicles.length || 'no'} vehicle{filteredVehicles.length == 1 || 's'}
          </h2>
          <div>
            {leftBarVisible ? 'hide results' : 'show results'}
            <input type="button" value={leftBarVisible?'←':'→'} onClick={()=>setLeftBarVisible(!leftBarVisible)} />
          </div>
        </div>
        {leftBarVisible && <>
          <form className={styles.leftBarCard}>
            <h2>filter results:</h2>
            <input type="text" value={filterInputs.line} onChange={e=>setFilterInput('line',e.currentTarget.value)} placeholder='line' />
            <input type="text" value={filterInputs.vehicleNumber} onChange={e=>setFilterInput('vehicleNumber',e.currentTarget.value)} placeholder='vehicle number' />
            <input type="text" value={filterInputs.make} onChange={e=>setFilterInput('make',e.currentTarget.value)} placeholder='producer' />
            <input type="text" value={filterInputs.model} onChange={e=>setFilterInput('model',e.currentTarget.value)} placeholder='model' />
            <select value={filterInputs.type} onChange={e=>setFilterInput('type',e.currentTarget.value)} placeholder='type'>
              <option value="">all</option>
              <option value="bus">bus</option>
              <option value="tram">tram</option>
            </select>
            <input type="button" onClick={applyFilter} value="apply"/>
          </form>
          {selectedVehicle&&(
          <div className={styles.leftBarCard + ' '+ styles.vehicleDetails}>
            {selectedVehicleDetails ? <>
              <div className='topLine'>
                <h2>{selectedVehicleDetails.year} {selectedVehicleDetails.make} {selectedVehicleDetails.model}</h2>
                <div>
                  <span onClick={()=>setDetailsExtended(!detailsExtended)}>{detailsExtended?'▲':'▼'}</span>
                  <span onClick={()=>selectVehicle(null)}>x</span>
                </div>
              </div>
              {detailsExtended&&<ul>
                <li>vehicle number: {selectedVehicleDetails.vehicleNumber}</li>
                <li>registration id: {selectedVehicleDetails.registrationId}</li>
                <li>carrier: {selectedVehicleDetails.carrier}</li>
                <li>depot: {selectedVehicleDetails.depot}</li>
                <li>ticket machine: {selectedVehicleDetails.ticketMachine ? 'available' : 'unavailable'}</li>
                <li>equipment: <ul>{selectedVehicleDetails.equipment.map(e=><li key={e}>{e}</li>)}</ul></li>
              </ul>}
            </>:<span>loading data...</span>}
          </div>
          )}
          {(vehicles.length && vehiclesWithBasicDetails.length) ?
          <div className={styles.vehiclesWithBasicDetails} ref={listRef}>
            <TransitionGroup>
              {vehiclesWithBasicDetails
              .filter(vehicle=>vehiclesToShowOnLeft.findIndex(v=>v.vehicleNumbers[0]==vehicle.vehicleNumber) !== -1)
              .filter(v=>indexes.findIndex(i=>v.vehicleNumber==i.id&&v.type==i.type)!==-1)
              .slice(0,50)
              .map(
                vehicle=>
                  {
                    const currentInfo = vehicles.find(v=>v.vehicleNumbers[0]==vehicle.vehicleNumber&&v.type==vehicle.type)
                    const selected = selectedVehicle?.type==vehicle.type&&selectedVehicle.vehicleNumber==vehicle.vehicleNumber
                    if(!currentInfo) return;
                    return (<CSSTransition timeout={250} classNames="vehicleItem" key={JSON.stringify(currentInfo)}>
                      <VehicleBasicDetails selected={selected} selectVehicle={selectVehicle} currentInfo={currentInfo} basicInfo={vehicle} />
                    </CSSTransition>)
                  }
              )}
            </TransitionGroup>
          </div>
          :
          <div className={styles.leftBarCard}>Loading...</div>
          }
        </>}
      </div>
      <div className={styles.map}>
        <Map
        onIdle={e=>updateVisibleVehicles(e.target)}
        onData={e=>updateVisibleVehicles(e.target)}
        onLoad={e=>updateVisibleVehicles(e.target)}
        onMoveEnd={e=>updateVisibleVehicles(e.target)}
        initialViewState={{latitude: 52.242177076328616, longitude: 21.02418860853867, zoom: 11}}
        mapboxAccessToken={mapboxAccessToken}
        ref={mapRef}
        mapStyle="mapbox://styles/szedann/cl2b5ep6m001y14nvu3yc3o0j">
          <Source type='geojson' data={{features:vehicles.filter(filter.filter).filter(v=>v.type==='bus').map(vehicle=>{return{
            geometry: {coordinates:vehicle.geo, type: 'Point'},
            type: 'Feature',
            properties:{
              ...vehicle,
              color: (selectedVehicle && selectedVehicle.type==vehicle.type && selectedVehicle.vehicleNumber==vehicle.vehicleNumbers[0])?'#980297':"#ffffff"
            },
            id:vehicle.vehicleNumbers[0]
            }}),type:'FeatureCollection'}}>
            <Layer {...busLayerStyle}/>
          </Source>
          <Source type='geojson' data={{features:filteredVehicles.filter(v=>v.type==='tram').map(vehicle=>{return{
            geometry: {coordinates:vehicle.geo, type: 'Point'},
            type: 'Feature',
            properties:{
              ...vehicle,
              color: (selectedVehicle && selectedVehicle.type==vehicle.type && selectedVehicle.vehicleNumber==vehicle.vehicleNumbers[0])?'#FD0017':"#ffffff"
            },
            id:vehicle.vehicleNumbers[0]
            }}),type:'FeatureCollection'}}>
            <Layer {...tramLayerStyle}/>
          </Source>
        </Map>
      </div>
    </div>
  )
}

export default Home
