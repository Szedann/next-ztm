import type { GetStaticProps, InferGetStaticPropsType, NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.scss'
import Map, { Layer, LayerProps, MapRef, Source } from 'react-map-gl';
import { KeyboardEventHandler, useEffect, useRef, useState } from 'react';
import { IVehicle, Vehicle } from '../types';
import mapboxgl, { MapLayerMouseEvent } from 'mapbox-gl';
import { CSSTransition, TransitionGroup } from 'react-transition-group';


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

const VehicleBasicDetails = ({basicInfo, currentInfo, id, selected}:{
  basicInfo:IVehicle,
  currentInfo:Vehicle,
  id:({type,id}:{type:'bus'|'tram',id:string})=>any,
  selected:boolean
  })=>{
  return <li
  className={styles.leftBarCard+' '+styles.vehicleCard}
  onClick={()=>{id({type:basicInfo.type,id:basicInfo.id})}}
  style={selected?{boxShadow:`0 0 3px 2px ${basicInfo.type=='bus'?'#909':'#f00'}, inset 0 0 3px 2px ${basicInfo.type=='bus'?'#909':'#f00'}`}:undefined}
  >
    <span style={{
      backgroundColor: basicInfo.type=='bus'?'#909':'#f00'
    }}>{basicInfo.type}</span>
    <h1>{currentInfo.line}</h1>
    <ul>
      <li>model: {basicInfo.brand} {basicInfo.model}</li>
      <li>vehicle number: {currentInfo.id.join('+')}</li>
      <li>depot: {basicInfo.depot}</li>  
      <li>carrier: {basicInfo.carrier}</li>  
    </ul>
  </li>
}

const getBasicDetails = async (limit:number, offset:number, ids:string[], options?:any) => {
  const l = limit.toString()
  const o = offset.toString()
  const idsString = ids.join(',')
  const params = new URLSearchParams({...options, limit: l, offset: o, ids: idsString});
  const ret = (await (await fetch(`/api/vehicles/?${params}`)).json()) as IVehicle[]
  return ret
}

const Home: NextPage = ({mapboxAccessToken}:InferGetStaticPropsType<typeof getStaticProps>) => {
  const [filterInputs, setFilterInputs] = useState({line:'',vehicleNumber:'',brand:'',model:'',type:''})
  const [vehicles, setVehicles] = useState([] as Vehicle[])
  const [filter, setFilter] = useState({filter:(a:Vehicle)=>true as boolean})
  const [vehiclesWithBasicDetails, setVehiclesWithBasicDetails] = useState([] as IVehicle[])
  const [indexes, setIndexes] = useState([] as {id:string,type:'bus'|'tram'}[])
  const [vehiclesToList, setVehiclesToList] = useState([] as Vehicle[])
  const [leftBarVisible, setLeftBarVisible] = useState(true)
  const [selectedVehicle, selectVehicle] = useState(null as {id:string,type:'bus'|'tram'}|null)
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState(null as IVehicle|null)
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
    setInterval(refreshData,30000)
  },[])

  useEffect(()=>{
    setSelectedVehicleDetails(null)
    if(!selectedVehicle) return;
    (async()=>{
      const params = new URLSearchParams(selectedVehicle).toString();
      const data = await (await fetch('/api/vehicleDetails?'+params)).json()
      setSelectedVehicleDetails(data)
      setDetailsExtended(true)
    })()
    mapRef.current?.flyTo({center:vehicles.find(v=>v.id[0]==selectedVehicle.id&&v.type==selectedVehicle.type)?.geo, zoom: 15})
  },[selectedVehicle])

  const setFilterInput = (key:string, value:any)=>{
    console.log(key, value)
    setFilterInputs({...filterInputs, [key]:value})
  }

  const applyFilter = ()=>{
    setFilter({filter:
    (a:Vehicle)=>{
      const details = vehiclesWithBasicDetails.find(v=>v.id == a.id[0] && v.type == a.type)
      if(filterInputs.brand && (filterInputs.brand.toLowerCase() != details?.brand.toLowerCase())) return false
      if(filterInputs.model && (filterInputs.model.toLowerCase() != details?.model.toLowerCase())) return false
      if(filterInputs.line && (filterInputs.line.toLowerCase() != a.line.toLowerCase())) return false
      if(filterInputs.vehicleNumber && (filterInputs.vehicleNumber.toLowerCase() != a.id[0].toLowerCase())) return false
      if(filterInputs.type && (filterInputs.type != a.type)) return false
      return true
    }
    })
  }

  const onkeyDownFilter:KeyboardEventHandler<HTMLInputElement> = (k)=>{
    if(k.key == "Enter") applyFilter()
  }

  useEffect(()=>{
    console.log(vehiclesWithBasicDetails)
  },[vehiclesWithBasicDetails])

  const updateVisibleVehicles = (map:mapboxgl.Map) =>{
    //@ts-expect-error
    setIndexes(map.queryRenderedFeatures({layers:['trams', 'buses']}).map(layer=>{return{id:layer.id,type:layer.properties.type}}))
  }

  useEffect(()=>{
    setVehiclesToList(
      vehicles
      .filter(filter.filter)
      .filter(v=>indexes.findIndex(i=>(v.id[0]==i.id)&&(v.type==i.type))!==-1)
      .slice(0,100))
  },[vehicles,indexes, filter])

  const mapClick=(e:MapLayerMouseEvent)=>{
    if(!e.features) return
    e.features[0].id
    selectVehicle({
      type: e.features[0].layer.id=='buses'?'bus':'tram',
      id: e.features[0].id as string
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
            {leftBarVisible ? 
              <>{filteredVehicles.length || 'no'} vehicle{filteredVehicles.length == 1 || 's'}</>
              : <>
                <input type="text" value={filterInputs.line} onKeyDown={onkeyDownFilter} onChange={e=>setFilterInput('line',e.currentTarget.value)} placeholder='line'/>
              </>
            }
            
          </h2>
          <div>
            {leftBarVisible ? 'hide results' : 'show results'}
            <input type="button" style={leftBarVisible?{transform: "rotate(180deg)"}:{transform: "rotate(0)"}} value="▼" onClick={()=>setLeftBarVisible(!leftBarVisible)} />
          </div>
        </div>
        {<div className={`${styles.leftBarElements} ${!leftBarVisible && styles.hidden}`}>
          <form className={styles.leftBarCard}>
            <h2>filter results:</h2>
            <input type="text" value={filterInputs.line} onKeyDown={onkeyDownFilter} onChange={e=>setFilterInput('line',e.currentTarget.value)} placeholder='line' />
            <input type="text" value={filterInputs.vehicleNumber} onKeyDown={onkeyDownFilter} onChange={e=>setFilterInput('vehicleNumber',e.currentTarget.value)} placeholder='vehicle number' />
            <input type="text" value={filterInputs.brand} onKeyDown={onkeyDownFilter} onChange={e=>setFilterInput('brand',e.currentTarget.value)} placeholder='producer' />
            <input type="text" value={filterInputs.model} onKeyDown={onkeyDownFilter} onChange={e=>setFilterInput('model',e.currentTarget.value)} placeholder='model' />
            <select title='Vehicle type' value={filterInputs.type} onChange={e=>setFilterInput('type',e.currentTarget.value)} placeholder='type'>
              <option value="">all</option>
              <option value="bus">bus</option>
              <option value="tram">tram</option>
            </select>
            <input type="button" onClick={applyFilter} value="apply"/>
          </form>
          <CSSTransition in={!!selectedVehicle} timeout={500} classNames={"selectedVehicle"}>
            <div className={`${!selectedVehicle && styles.hidden}`}>
              <div className={styles.leftBarCard + ' '+ styles.vehicleDetails}>
                <div className='topLine'>
                  <h2>{selectedVehicleDetails ? <>{selectedVehicleDetails.year} {selectedVehicleDetails.brand} {selectedVehicleDetails.model}</> : "loading..."}</h2>
                  <div>
                    <span onClick={()=>setDetailsExtended(!detailsExtended)} className={styles.extendButton} style={detailsExtended?{transform: "rotate(180deg)"}:{transform: "rotate(0)"}}>▼</span>
                    <span onClick={()=>selectVehicle(null)}>x</span>
                  </div>
                </div>
                <ul style={{height: (selectedVehicleDetails && detailsExtended) ?
                  (((selectedVehicleDetails.equipment?.length||-1)+5
                    +(selectedVehicleDetails.registrationNumber ? 1 : 0))*1.15
                  )+"em":"0px", opacity: selectedVehicleDetails && detailsExtended?1:0}} className={styles.selectedVehicleDetails}>
                    <li>vehicle number: {selectedVehicleDetails?.id}</li>
                    {selectedVehicleDetails?.registrationNumber && <li>registration id: {selectedVehicleDetails?.registrationNumber}</li>}
                    <li>carrier: {selectedVehicleDetails?.carrier}</li>
                    <li>depot: {selectedVehicleDetails?.depot}</li>
                    <li>ticket machine: {selectedVehicleDetails?.ticketMachine ? 'available' : 'unavailable'}</li>
                    {selectedVehicleDetails?.equipment && <li>equipment: <ul>{selectedVehicleDetails.equipment.map(e=><li key={e}>{e}</li>)}</ul></li>}
                </ul>
              </div>
            </div>
          </CSSTransition>
          {(vehicles.length && vehiclesWithBasicDetails.length) ?
          <div className={styles.vehiclesWithBasicDetails} ref={listRef}>
            <TransitionGroup>
              {vehiclesWithBasicDetails
              .filter(
                vehicle=>
                (vehiclesToList.findIndex(v=>v.id[0]==vehicle.id&&v.type==vehicle.type) !== -1)
                || (selectedVehicle?.type==vehicle.type&&selectedVehicle?.id==vehicle.id)
              )
              .sort((a)=>selectedVehicle ?((selectedVehicle?.type==a.type&&selectedVehicle.id==a.id)?-1:1) : 0)
              .slice(0,50)
              .map(
                vehicle=>
                  {
                    const currentInfo = vehicles.find(v=>v.id[0]==vehicle.id&&v.type==vehicle.type)
                    const selected = selectedVehicle?.type==vehicle.type&&selectedVehicle?.id==vehicle.id
                    if(!currentInfo) return;
                    return (<CSSTransition timeout={250} classNames="vehicleItem" key={currentInfo.type+currentInfo.id}>
                      <VehicleBasicDetails selected={selected} id={selectVehicle} currentInfo={currentInfo} basicInfo={vehicle} />
                    </CSSTransition>)
                  }
              )}
            </TransitionGroup>
          </div>
          :
          <div className={styles.leftBarCard}>Loading...</div>
          }
        </div>}
      </div>
      <div className={styles.copyrightBar}>
        copyright &copy; <a href="https://github.com/Szedann">Szedann</a> | 
        maps: &copy; <a href="">OpenStreetMap</a>, &copy; <a href="">Mapbox</a> | 
        live vehicle data: &copy; <a href="http://api.um.warszawa.pl">Miasto Stołeczne Warszawa</a>

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
              color: (selectedVehicle && selectedVehicle.type==vehicle.type && selectedVehicle.id==vehicle.id[0])?'#980297':"#ffffff"
            },
            id:vehicle.id[0]
            }}),type:'FeatureCollection'}}>
            <Layer {...busLayerStyle}/>
          </Source>
          <Source type='geojson' data={{features:filteredVehicles.filter(v=>v.type==='tram').map(vehicle=>{return{
            geometry: {coordinates:vehicle.geo, type: 'Point'},
            type: 'Feature',
            properties:{
              ...vehicle,
              color: (selectedVehicle && selectedVehicle.type==vehicle.type && selectedVehicle.id==vehicle.id[0])?'#FD0017':"#ffffff"
            },
            id:vehicle.id[0]
            }}),type:'FeatureCollection'}}>
            <Layer {...tramLayerStyle}/>
          </Source>
        </Map>
      </div>
    </div>
  )
}

export default Home
