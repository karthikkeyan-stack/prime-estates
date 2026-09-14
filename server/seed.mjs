/**
 * Idempotent demo seed for Prime Estates.
 *
 * Creates taxonomies, site settings, gallery, services and 18 demo
 * properties. Every listing is clearly marked demo content in the DB via
 * `rera_id = ''` and a disclaimer in site_settings — replace with real
 * client data by editing rows in the admin panel.
 */
import { query, rows, one } from './db.mjs';
import { ensureAdminUser } from './auth.mjs';

const IMG = {
  hero: '/media/hero-estate.jpg',
  kensington: '/media/prop-kensington-manor.jpg',
  penthouse: '/media/prop-aura-penthouse.jpg',
  tea: '/media/prop-balfour-tea-estate.jpg',
  villa: '/media/prop-aethelgard-villa.jpg',
  commercial: '/media/prop-apex-commercial.jpg',
  farmstead: '/media/prop-anamalai-farmstead.jpg',
  plots: '/media/cat-plots.jpg',
  showroom: '/media/cat-showroom.jpg',
  office: '/media/about-office.jpg',
};

const SETTINGS = {
  business_name: 'Prime Estates',
  tagline: 'Consultants & Developers • CBE',
  phone: '9486122022',
  phone_display: '+91 94861 22022',
  whatsapp: '919486122022',
  email: '',
  address: '',
  maps_url: '',
  maps_embed: '',
  established: '2008',
  city: 'Coimbatore',
  description:
    'Greetings from Prime Estates! We are one of the leading real estate consultants & developers in Coimbatore since 2008. We offer a wide range of residential and commercial properties for outright purchase and rental in and around Coimbatore and neighbouring districts like Tirupur, Pollachi, Ooty, Erode and Palakkad.',
  short_description:
    'Leading real estate consultants & developers in Coimbatore since 2008, offering residential and commercial properties for outright purchase and rental.',
  whatsapp_general: "Hi, I'd like to know more about the properties available with Prime Estates.",
  seo_title: 'Prime Estates | Real Estate Consultants & Developers in Coimbatore',
  seo_description:
    'Prime Estates — leading real estate consultants & developers in Coimbatore since 2008. Residential and commercial properties for sale and rent across Coimbatore, Tirupur, Pollachi, Ooty, Erode and Palakkad.',
  footer_note: 'Prime Estates — Real estate consultants & developers, Coimbatore. Established 2008.',
  // Blank on purpose: set the real domain in Admin -> Settings. Until then the
  // sitemap and canonicals fall back to the host actually serving the request,
  // rather than asserting a domain the client may not own.
  site_url: '',
  facebook: '', instagram: '', youtube: '', linkedin: '',
  demo_notice: 'Listings shown are illustrative demo data prepared for this preview.',
};

const CATEGORIES = [
  ['villa', 'Villas & Bungalows', 'Gated luxury enclaves and independent residences.', 'villa', IMG.villa, 1],
  ['apartment', 'Apartments & Penthouses', 'Sky residences and premium city apartments.', 'apartment', IMG.penthouse, 2],
  ['plot', 'Plots & Farmlands', 'Approved residential plots, agro groves and farm layouts.', 'landscape', IMG.plots, 3],
  ['commercial', 'Commercial & IT Spaces', 'Office blocks, IT floors and pre-leased assets.', 'corporate_fare', IMG.commercial, 4],
  ['showroom', 'Showrooms & Retail', 'Main-road retail frontages and showroom spaces.', 'storefront', IMG.showroom, 5],
  ['farmhouse', 'Plantations & Hill Retreats', 'Tea estates, coconut groves and hill properties.', 'forest', IMG.tea, 6],
  ['independent-house', 'Independent Houses', 'Individual houses on own land parcels.', 'home', IMG.kensington, 7],
  ['office', 'Office Spaces', 'Fitted and bare-shell office floors.', 'business_center', IMG.office, 8],
  ['shop', 'Shops', 'Compact retail units in high-footfall streets.', 'store', IMG.showroom, 9],
  ['investment', 'Investment Assets', 'Yield-focused and pre-leased opportunities.', 'trending_up', IMG.commercial, 10],
];

const LOCATIONS = [
  ['coimbatore', 'Coimbatore', 'Coimbatore', 'Race Course, RS Puram, Avinashi Road, Saravanampatti and Trichy Road corridors.', 'Metropolitan & IT Hub', 1],
  ['tirupur', 'Tirupur', 'Tirupur', 'Export hub, Ring Road, Palladam Road and Avinashi corridor.', 'Textile & Export Belt', 2],
  ['pollachi', 'Pollachi', 'Coimbatore', 'Coconut groves, Anamalai foothills and agro corridors.', 'Agro & Farmland Belt', 3],
  ['ooty', 'Ooty & The Nilgiris', 'Nilgiris', 'Ooty, Coonoor and Kotagiri hill properties and estates.', 'Hill Station Retreats', 4],
  ['erode', 'Erode', 'Erode', 'Perundurai industrial belt, logistics parks and township plots.', 'Industrial & Logistics', 5],
  ['palakkad', 'Palakkad', 'Palakkad', 'Palakkad highway corridor and Walayar border developments.', 'Kerala Border Corridor', 6],
];

const SERVICES = [
  ['residential-property', 'Residential Property', 'Villas, apartments and independent houses matched to how your family actually lives.', 'Our residential desk covers gated villa enclaves, high-rise apartments, penthouses and independent houses across Coimbatore and the neighbouring districts. We shortlist on the fundamentals that matter — approach road, water table, approvals, neighbourhood trajectory and resale depth — then walk you through each option in person.', 'home_work', 1],
  ['commercial-property', 'Commercial Property', 'Offices, IT floors, showrooms and retail frontages in proven catchments.', 'We advise on commercial acquisitions and leasing across the Avinashi Road, Trichy Road and Saravanampatti corridors, as well as Tirupur and Erode. Footfall patterns, frontage width, parking ratios and tenant covenant strength are assessed before a property reaches your shortlist.', 'corporate_fare', 2],
  ['property-sales', 'Property Sales', 'End-to-end outright purchase and sale representation.', 'From valuation and buyer sourcing to negotiation, advance agreement, registration and handover, we manage the full transaction. Sellers receive a realistic pricing band based on comparable registrations, not inflated estimates.', 'sell', 3],
  ['property-rentals', 'Property Rentals', 'Residential and commercial rentals, leasing and tenant placement.', 'We place tenants in homes, offices, showrooms and warehouses, handle lease structuring and renewals, and advise landlords on rent benchmarking, deposit norms and maintenance responsibilities.', 'key', 4],
  ['real-estate-consulting', 'Real Estate Consulting', 'Independent advice before you commit capital.', 'Established in 2008, our consulting practice helps buyers, investors and NRIs evaluate micro-markets, verify documentation, understand approvals and time their entry. We are happy to advise against a purchase when the numbers do not work.', 'monitoring', 5],
  ['plots-land', 'Plots & Land', 'Approved plots, farmland and development parcels.', 'We handle DTCP-approved layouts, agricultural land, coconut groves and hillside parcels across Pollachi, Palakkad, Erode and the Nilgiris — including extent verification, patta and boundary checks.', 'landscape', 6],
  ['property-development', 'Property Development', 'Developer-side project planning and delivery.', 'As developers ourselves, we take on layout planning, approvals coordination, joint-venture structuring and project execution, bringing the same diligence we apply to our clients’ acquisitions.', 'architecture', 7],
];

const AMEN = {
  villa: ['Private Garden', 'Covered Car Parking', 'Modular Kitchen', 'Power Backup', '24x7 Security', 'Rainwater Harvesting', 'Servant Quarters', 'Borewell & Corporation Water'],
  apt: ['Lift', 'Covered Parking', 'Power Backup', 'Gymnasium', 'Children’s Play Area', 'Clubhouse', 'Intercom', '24x7 Security'],
  comm: ['Passenger & Service Lifts', 'DG Power Backup', 'Central Air Conditioning', 'Ample Parking', 'Fire Safety Systems', 'CCTV Surveillance'],
  land: ['Compound Wall', 'Approach Road', 'Borewell', 'Electricity Connection', 'Clear Boundary Stones'],
};

/** id-free property definitions — slug is derived, prices are in rupees. */
const PROPERTIES = [
  {
    title: 'The Kensington Manor', type: 'independent-house', listing: 'sale', price: 42500000,
    loc: 'Race Course, Coimbatore', locSlug: 'coimbatore', locality: 'Race Course', city: 'Coimbatore', district: 'Coimbatore',
    beds: 4, baths: 5, parking: 6, area: 4800, plot: 9.2, facing: 'North', furnishing: 'Semi-Furnished', age: '3 years',
    img: IMG.kensington, featured: true, verified: true, floors: 2,
    short: 'Colonial-contemporary mansion with plunge pool and teak interiors on Coimbatore’s most prestigious boulevard.',
    desc: 'An independent custom-built residence on Race Course, arranged around a central double-height living hall with full-height glazing to a landscaped rear garden. The ground floor holds formal living and dining, a Burma teak library, guest suite and a service kitchen alongside the main modular kitchen. Four ensuite bedrooms occupy the first floor, each with a private balcony. A covered basement pavilion accommodates six cars. The plot is walled on all sides with a secondary service entrance.',
    amen: AMEN.villa.concat(['Swimming Pool', 'Home Theatre', 'Landscaped Garden', 'Basement Parking']),
    high: ['Walled 9.2 cent plot', 'Six-car basement pavilion', 'Burma teak joinery throughout'],
    lat: 11.0021, lng: 76.9720,
  },
  {
    title: 'Aura Horizon Penthouse', type: 'apartment', listing: 'sale', price: 21000000,
    loc: 'Avinashi Road, Coimbatore', locSlug: 'coimbatore', locality: 'Avinashi Road', city: 'Coimbatore', district: 'Coimbatore',
    beds: 3, baths: 3, parking: 2, area: 2850, facing: 'East', furnishing: 'Fully Furnished', age: '1 year',
    img: IMG.penthouse, featured: true, verified: true, floor: 18, floors: 18,
    short: 'Duplex sky residence with a private terrace pool and uninterrupted Western Ghats views.',
    desc: 'A top-floor duplex on Avinashi Road with a 900 sq.ft private terrace, plunge pool and outdoor kitchen. The lower level opens into a combined living and dining volume with Italian marble flooring and a glazed stair core. Three bedrooms, all ensuite, occupy the upper level with the master opening onto a west-facing deck. Two dedicated covered car parks and a private lift lobby are included.',
    amen: AMEN.apt.concat(['Private Terrace Pool', 'Private Lift Lobby', 'Concierge Desk', 'Visitor Parking']),
    high: ['900 sq.ft private terrace', 'Private lift lobby', 'Fully furnished handover'],
    lat: 11.0183, lng: 77.0121,
  },
  {
    title: 'Balfour Heritage Tea Estate', type: 'farmhouse', listing: 'sale', price: 125000000,
    loc: 'Coonoor, The Nilgiris', locSlug: 'ooty', locality: 'Coonoor', city: 'Coonoor', district: 'Nilgiris',
    area: 42, areaUnit: 'acre', facing: 'East', age: 'Heritage',
    img: IMG.tea, featured: true, verified: true,
    short: 'Forty-two acre working tea estate with a restored colonial bungalow and factory access.',
    desc: 'A contiguous 42-acre tea estate in the Coonoor belt, planted in mature contour rows with silver oak shade cover. The property includes a restored four-bedroom colonial bungalow with original fireplaces and teak flooring, staff quarters, a spring-fed water source and vehicular access to the estate road. Leaf is currently routed to a nearby bought-leaf factory; the holding suits a private estate buyer or a boutique hospitality conversion, subject to approvals.',
    amen: ['Restored Colonial Bungalow', 'Spring Water Source', 'Staff Quarters', 'Estate Road Access', 'Mature Tea Plantation'],
    high: ['42 contiguous acres', 'Restored heritage bungalow', 'Spring-fed water source'],
    lat: 11.3530, lng: 76.7959,
  },
  {
    title: 'The Aethelgard Gated Villa', type: 'villa', listing: 'sale', price: 18500000,
    loc: 'Saravanampatti, Coimbatore', locSlug: 'coimbatore', locality: 'Saravanampatti', city: 'Coimbatore', district: 'Coimbatore',
    beds: 4, baths: 4, parking: 2, area: 3200, plot: 6, facing: 'East', furnishing: 'Semi-Furnished', age: 'New',
    img: IMG.villa, featured: true, verified: true, floors: 2,
    short: 'Contemporary four-bedroom villa inside a gated enclave minutes from the IT corridor.',
    desc: 'Part of a 24-villa gated enclave off Saravanampatti, this east-facing home is arranged over two floors with a double-height entrance foyer, open-plan living and a rear deck facing the community green. Finishes include vitrified flooring, granite counters and a modular kitchen. The enclave provides a clubhouse, gym, children’s play area and gated security with CCTV at the entrance.',
    amen: AMEN.villa.concat(['Clubhouse Access', 'Gated Community', 'Community Park']),
    high: ['24-villa gated enclave', 'Minutes from the IT corridor', 'Clubhouse and gym access'],
    lat: 11.0785, lng: 77.0027,
  },
  {
    title: 'Apex Commercial Centre', type: 'commercial', listing: 'sale', price: 162000000,
    loc: 'Peelamedu, Coimbatore', locSlug: 'coimbatore', locality: 'Peelamedu', city: 'Coimbatore', district: 'Coimbatore',
    area: 38000, facing: 'North', age: '6 years', floors: 6,
    img: IMG.commercial, featured: true, verified: true,
    short: 'Pre-leased six-floor commercial block on Avinashi Road with established IT tenants.',
    desc: 'A six-floor commercial building of approximately 38,000 sq.ft built-up on the Peelamedu stretch of Avinashi Road. The asset is substantially pre-leased to technology and services tenants on multi-year agreements with periodic escalations. Two passenger lifts and one service lift, DG backup for common areas and tenant floors, and basement plus stilt parking. Suited to an investor seeking a stabilised yield asset.',
    amen: AMEN.comm.concat(['Pre-Leased Tenants', 'Basement Parking', 'Two Passenger Lifts']),
    high: ['Approx. 38,000 sq.ft built-up', 'Substantially pre-leased', 'Avinashi Road frontage'],
    lat: 11.0269, lng: 77.0270,
  },
  {
    title: 'Anamalai Foothills Farmstead', type: 'farmhouse', listing: 'sale', price: 34000000,
    loc: 'Pollachi, Coimbatore District', locSlug: 'pollachi', locality: 'Anamalai Road', city: 'Pollachi', district: 'Coimbatore',
    beds: 3, baths: 2, area: 8.5, areaUnit: 'acre', facing: 'South', age: '12 years',
    img: IMG.farmstead, verified: true,
    short: 'Productive coconut farmstead with a farmhouse and drip irrigation at the Anamalai foothills.',
    desc: 'An 8.5-acre coconut holding on the Pollachi–Anamalai stretch with roughly 900 bearing palms under drip irrigation from two borewells. A three-bedroom farmhouse with a wide verandah sits at the road end of the property, along with a storage shed and caretaker quarters. Red loam soil, tarred road frontage and an existing electricity service connection.',
    amen: AMEN.land.concat(['Drip Irrigation', 'Two Borewells', 'Farmhouse', 'Caretaker Quarters']),
    high: ['Approx. 900 bearing palms', 'Drip irrigated from two borewells', 'Tarred road frontage'],
    lat: 10.6589, lng: 77.0086,
  },
  {
    title: 'Vaidehi Residency 3 BHK', type: 'apartment', listing: 'sale', price: 8200000,
    loc: 'RS Puram, Coimbatore', locSlug: 'coimbatore', locality: 'RS Puram', city: 'Coimbatore', district: 'Coimbatore',
    beds: 3, baths: 3, parking: 1, area: 1650, facing: 'North', furnishing: 'Unfurnished', age: '5 years', floor: 4, floors: 7,
    img: IMG.penthouse, verified: true,
    short: 'Well-planned three-bedroom apartment in the heart of RS Puram with covered parking.',
    desc: 'A north-facing apartment on the fourth floor of a seven-floor residential building in RS Puram, walking distance from schools, clinics and the main shopping street. The layout provides a combined living and dining area, three bedrooms with wardrobes, a utility balcony and a covered car park. Lift, generator backup for common areas and round-the-clock security.',
    amen: AMEN.apt, high: ['Central RS Puram location', 'Covered car parking', 'Walk to schools and clinics'],
    lat: 11.0069, lng: 76.9490,
  },
  {
    title: 'Nilgiri Pine Cottage', type: 'independent-house', listing: 'sale', price: 15500000,
    loc: 'Fernhill, Ooty', locSlug: 'ooty', locality: 'Fernhill', city: 'Ooty', district: 'Nilgiris',
    beds: 3, baths: 3, parking: 2, area: 2200, plot: 14, facing: 'East', furnishing: 'Furnished', age: '20 years',
    img: IMG.tea, verified: true, floors: 2,
    short: 'Stone-and-timber hill cottage with valley views and a mature garden near Fernhill.',
    desc: 'A characterful three-bedroom cottage on 14 cents at Fernhill, built in local stone with timber gables and a working fireplace in the living room. Large windows frame the valley and the garden is planted with mature roses, camellias and fruit trees. Includes a detached garage, caretaker room and municipal water alongside a rainwater sump.',
    amen: ['Fireplace', 'Mature Garden', 'Detached Garage', 'Caretaker Room', 'Rainwater Sump', 'Valley View'],
    high: ['14 cent garden plot', 'Working fireplace', 'Uninterrupted valley view'],
    lat: 11.3922, lng: 76.6950,
  },
  {
    title: 'Perundurai Logistics Warehouse', type: 'commercial', listing: 'lease', price: 425000, period: 'month',
    loc: 'Perundurai, Erode', locSlug: 'erode', locality: 'Perundurai SIPCOT', city: 'Erode', district: 'Erode',
    area: 34000, facing: 'West', age: '4 years',
    img: IMG.commercial,
    short: 'Pre-engineered warehouse with dock levellers on the Perundurai industrial belt.',
    desc: 'A 34,000 sq.ft pre-engineered steel warehouse in the Perundurai industrial belt with a 9-metre clear height, four dock levellers and a concrete hardstand yard for trailer movement. Three-phase power, fire hydrant system and a site office block. Suits third-party logistics, textile warehousing or distribution use. Available on a long lease with a standard escalation structure.',
    amen: ['Dock Levellers', '9m Clear Height', 'Three-Phase Power', 'Fire Hydrant System', 'Trailer Yard', 'Site Office'],
    high: ['9 metre clear height', 'Four dock levellers', 'SIPCOT belt location'],
    lat: 11.2760, lng: 77.5860,
  },
  {
    title: 'Mettupalayam Road Showroom', type: 'showroom', listing: 'rent', price: 285000, period: 'month',
    loc: 'Mettupalayam Road, Coimbatore', locSlug: 'coimbatore', locality: 'Mettupalayam Road', city: 'Coimbatore', district: 'Coimbatore',
    area: 5200, facing: 'East', age: '8 years', floors: 2,
    img: IMG.showroom,
    short: 'Double-height retail showroom with 48 ft frontage on a high-traffic arterial road.',
    desc: 'A ground-plus-one showroom with approximately 48 feet of glazed frontage on Mettupalayam Road. Double-height display area at street level, mezzanine office, customer washrooms and rear service access. Dedicated frontage parking for eight cars. Suitable for automobile, furniture, electronics or branded retail formats.',
    amen: ['48 ft Road Frontage', 'Double-Height Display', 'Mezzanine Office', 'Customer Parking', 'Rear Service Access', 'Power Backup'],
    high: ['48 ft glazed frontage', 'Parking for eight cars', 'Arterial road position'],
    lat: 11.0410, lng: 76.9420,
  },
  {
    title: 'Kovai Green Meadows Plot', type: 'plot', listing: 'sale', price: 4800000,
    loc: 'Thudiyalur, Coimbatore', locSlug: 'coimbatore', locality: 'Thudiyalur', city: 'Coimbatore', district: 'Coimbatore',
    area: 4.8, areaUnit: 'cent', facing: 'North', verified: true,
    img: IMG.plots,
    short: 'North-facing residential plot in an approved layout with formed roads and street lighting.',
    desc: 'A 4.8 cent north-facing plot in a residential layout at Thudiyalur with formed black-top roads, storm water drains, street lighting and underground electricity. The layout is walled with a single gated entrance and several houses are already constructed and occupied. Suitable for immediate construction; patta available in the seller’s name.',
    amen: AMEN.land.concat(['Street Lighting', 'Storm Water Drains', 'Gated Layout']),
    high: ['Approved residential layout', 'Formed roads and drains', 'Ready for construction'],
    lat: 11.0880, lng: 76.9330,
  },
  {
    title: 'Tirupur Export House', type: 'commercial', listing: 'sale', price: 58000000,
    loc: 'Palladam Road, Tirupur', locSlug: 'tirupur', locality: 'Palladam Road', city: 'Tirupur', district: 'Tirupur',
    area: 22000, facing: 'South', age: '10 years', floors: 3,
    img: IMG.commercial, verified: true,
    short: 'Three-floor garment unit with fitted production floors on Palladam Road.',
    desc: 'A purpose-built garment production facility of approximately 22,000 sq.ft across three floors on Palladam Road, Tirupur. Includes open production floors with adequate natural light, a goods lift, compressor room, effluent-compliant washroom blocks, a canteen and an administrative office block. Transformer capacity and a covered loading bay are in place.',
    amen: ['Goods Lift', 'Transformer Capacity', 'Covered Loading Bay', 'Canteen Block', 'Administrative Office', 'Compressor Room'],
    high: ['Approx. 22,000 sq.ft across three floors', 'Fitted production floors', 'Palladam Road access'],
    lat: 11.1085, lng: 77.3411,
  },
  {
    title: 'Sundara Villa 4 BHK', type: 'villa', listing: 'rent', price: 95000, period: 'month',
    loc: 'Vadavalli, Coimbatore', locSlug: 'coimbatore', locality: 'Vadavalli', city: 'Coimbatore', district: 'Coimbatore',
    beds: 4, baths: 4, parking: 2, area: 3000, facing: 'East', furnishing: 'Fully Furnished', age: '6 years', floors: 2,
    img: IMG.villa,
    short: 'Fully furnished four-bedroom villa for rent near the university belt at Vadavalli.',
    desc: 'An east-facing furnished villa at Vadavalli offered on a long-term residential lease. Four bedrooms with wardrobes and air conditioning, a furnished living and dining area, a modular kitchen with appliances, and a landscaped rear garden. Two covered car parks, inverter backup and a borewell in addition to corporation water. Preferred for families or long-stay corporate tenants.',
    amen: AMEN.villa.concat(['Air Conditioned Bedrooms', 'Inverter Backup', 'Furnished Handover']),
    high: ['Fully furnished with appliances', 'Landscaped rear garden', 'Near the university belt'],
    lat: 11.0245, lng: 76.8930,
  },
  {
    title: 'Palakkad Highway Land Parcel', type: 'plot', listing: 'sale', price: 27500000,
    loc: 'Walayar, Palakkad', locSlug: 'palakkad', locality: 'Walayar', city: 'Palakkad', district: 'Palakkad',
    area: 5.5, areaUnit: 'acre', facing: 'North', verified: true,
    img: IMG.plots,
    short: 'Highway-facing 5.5 acre parcel suited to commercial or industrial development.',
    desc: 'A 5.5-acre parcel with direct frontage on the Coimbatore–Palakkad national highway corridor near Walayar. Level terrain, red soil, existing compound on two sides and an approach from the service road. The location suits warehousing, a highway commercial format or an industrial unit, subject to the applicable approvals and conversions.',
    amen: AMEN.land.concat(['Highway Frontage', 'Level Terrain', 'Service Road Approach']),
    high: ['Direct highway frontage', '5.5 acre contiguous parcel', 'Level, buildable terrain'],
    lat: 10.8180, lng: 76.8460,
  },
  {
    title: 'Trichy Road Office Floor', type: 'office', listing: 'lease', price: 190000, period: 'month',
    loc: 'Trichy Road, Coimbatore', locSlug: 'coimbatore', locality: 'Trichy Road', city: 'Coimbatore', district: 'Coimbatore',
    area: 4400, facing: 'East', age: '5 years', floor: 3, floors: 6, furnishing: 'Semi-Furnished',
    img: IMG.office,
    short: 'Semi-fitted 4,400 sq.ft office floor with cabins, workstations and backup power.',
    desc: 'A full third floor of approximately 4,400 sq.ft on Trichy Road, handed over semi-fitted with four cabins, a conference room, a pantry and an open workstation area. Central air conditioning, full DG backup, two lifts and covered parking for eight cars. Suited to a services firm, back office or professional practice.',
    amen: AMEN.comm.concat(['Four Cabins', 'Conference Room', 'Pantry', 'Covered Parking']),
    high: ['Full-floor plate', 'Semi-fitted with cabins', 'Full DG backup'],
    lat: 10.9940, lng: 77.0080,
  },
  {
    title: 'Gandhipuram Retail Shop', type: 'shop', listing: 'rent', price: 68000, period: 'month',
    loc: 'Gandhipuram, Coimbatore', locSlug: 'coimbatore', locality: 'Gandhipuram', city: 'Coimbatore', district: 'Coimbatore',
    area: 850, facing: 'West', age: '15 years',
    img: IMG.showroom,
    short: 'Compact ground-floor shop in the Gandhipuram commercial core with heavy footfall.',
    desc: 'An 850 sq.ft ground-floor shop unit in the Gandhipuram commercial district, with a rolling shutter frontage, an attached storage area and a washroom. High pedestrian footfall through the day with bus terminus traffic nearby. Suitable for apparel, mobile, food or service retail formats.',
    amen: ['Rolling Shutter Frontage', 'Attached Storage', 'Washroom', 'High Footfall Location', 'Three-Phase Power'],
    high: ['Gandhipuram commercial core', 'Heavy pedestrian footfall', 'Attached storage area'],
    lat: 11.0168, lng: 76.9660,
  },
  {
    title: 'Kurichi Budget 2 BHK', type: 'apartment', listing: 'rent', price: 16500, period: 'month',
    loc: 'Kurichi, Coimbatore', locSlug: 'coimbatore', locality: 'Kurichi', city: 'Coimbatore', district: 'Coimbatore',
    beds: 2, baths: 2, parking: 1, area: 920, facing: 'South', furnishing: 'Unfurnished', age: '7 years', floor: 2, floors: 4,
    img: IMG.penthouse,
    short: 'Practical two-bedroom apartment for rent close to the Kurichi industrial area.',
    desc: 'A south-facing two-bedroom apartment on the second floor of a four-floor building at Kurichi, convenient for the industrial area and the Sundarapuram belt. Living and dining area, two bedrooms with wardrobes, a utility balcony and one two-wheeler plus one car park. Lift and 24-hour water supply from a common sump and borewell.',
    amen: ['Lift', 'Car Parking', '24x7 Water Supply', 'Utility Balcony', 'Security'],
    high: ['Close to the industrial belt', 'Dedicated car park', 'Reliable water supply'],
    lat: 10.9430, lng: 76.9660,
  },
  {
    title: 'Sulur Investment Plot Cluster', type: 'investment', listing: 'sale', price: 9600000,
    loc: 'Sulur, Coimbatore', locSlug: 'coimbatore', locality: 'Sulur', city: 'Coimbatore', district: 'Coimbatore',
    area: 12, areaUnit: 'cent', facing: 'East', verified: true,
    img: IMG.plots,
    short: 'Twelve cents in an appreciating Sulur corridor, available as a single parcel.',
    desc: 'A contiguous twelve-cent holding in the Sulur corridor, positioned between the airport stretch and the Kangayam Road growth direction. Offered as a single parcel and suitable for a long-hold investor or for splitting into individual house plots later, subject to the applicable layout approvals. Patta available, boundaries stone-marked, road formed to the property edge.',
    amen: AMEN.land, high: ['Twelve contiguous cents', 'Appreciating corridor', 'Stone-marked boundaries'],
    lat: 11.0260, lng: 77.1260,
  },
];

function slugify(t) {
  return String(t).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function formatPrice(value, listing, period) {
  const n = Number(value) || 0;
  let label;
  if (n >= 1e7) label = `₹${(n / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  else if (n >= 1e5) label = `₹${(n / 1e5).toFixed(2).replace(/\.00$/, '')} Lakh`;
  else label = `₹${n.toLocaleString('en-IN')}`;
  if (listing === 'rent' || listing === 'lease') label += period ? `/${period}` : '/month';
  return label;
}

export async function seed({ force = false } = {}) {
  await ensureAdminUser();

  for (const [key, value] of Object.entries(SETTINGS)) {
    await query(
      `INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
  for (const [slug, name, description, icon, image_url, sort_order] of CATEGORIES) {
    await query(
      `INSERT INTO property_categories (slug, name, description, icon, image_url, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO UPDATE
         SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
             image_url=EXCLUDED.image_url, sort_order=EXCLUDED.sort_order`,
      [slug, name, description, icon, image_url, sort_order],
    );
  }
  for (const [slug, name, district, localities, tagline, sort_order] of LOCATIONS) {
    await query(
      `INSERT INTO locations (slug, name, district, localities, tagline, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO UPDATE
         SET name=EXCLUDED.name, district=EXCLUDED.district, localities=EXCLUDED.localities,
             tagline=EXCLUDED.tagline, sort_order=EXCLUDED.sort_order`,
      [slug, name, district, localities, tagline, sort_order],
    );
  }
  for (const [slug, title, summary, body, icon, sort_order] of SERVICES) {
    await query(
      `INSERT INTO services (slug, title, summary, body, icon, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO UPDATE
         SET title=EXCLUDED.title, summary=EXCLUDED.summary, body=EXCLUDED.body,
             icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order`,
      [slug, title, summary, body, icon, sort_order],
    );
  }

  const existing = (await one('SELECT COUNT(*)::int AS c FROM properties'))?.c ?? 0;
  if (existing > 0 && !force) {
    return { skipped: true, properties: existing };
  }
  if (force) {
    await query('DELETE FROM property_images');
    await query('DELETE FROM properties');
  }

  for (const p of PROPERTIES) {
    const slug = slugify(p.title);
    const areaUnit = p.areaUnit || 'sqft';
    const priceDisplay = formatPrice(p.price, p.listing, p.period);
    const status = p.featured ? 'featured' : 'available';
    const seoTitle = `${p.title} — ${p.loc} | Prime Estates`;
    const seoDesc = p.short.slice(0, 300);

    const row = await one(
      `INSERT INTO properties (
         title, slug, property_type, listing_type, status, price, price_display, price_period,
         location, location_slug, area_locality, city, district, state, address, latitude, longitude,
         property_area, property_area_unit, built_up_area, bedrooms, bathrooms, parking, floor, total_floors,
         property_age, facing, furnishing, short_description, description, amenities, highlights,
         featured, published, verified_title, main_image, seo_title, seo_description
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38
       ) RETURNING id`,
      [
        p.title, slug, p.type, p.listing, status, p.price, priceDisplay, p.period || '',
        p.loc, p.locSlug, p.locality || '', p.city || '', p.district || '', 'Tamil Nadu', '',
        p.lat ?? null, p.lng ?? null,
        p.area ?? null, areaUnit, p.type === 'plot' || p.type === 'investment' ? null : (p.area ?? null),
        p.beds ?? null, p.baths ?? null, p.parking ?? null, p.floor ?? null, p.floors ?? null,
        p.age || '', p.facing || '', p.furnishing || '',
        p.short, p.desc, p.amen || [], p.high || [],
        Boolean(p.featured), true, Boolean(p.verified), p.img,
        seoTitle, seoDesc,
      ],
    );

    // Gallery: main image plus contextual supporting shots.
    const extras = [p.img, IMG.hero, IMG.office, IMG.villa].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    for (const [i, url] of extras.entries()) {
      await query(
        'INSERT INTO property_images (property_id, url, alt, is_primary, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [row.id, url, `${p.title} — ${p.loc} (view ${i + 1})`, i === 0, i],
      );
    }
  }

  const galleryItems = [
    [IMG.hero, 'Contemporary estate residence at dusk', 'Residences', 1],
    [IMG.kensington, 'Neoclassical manor with landscaped forecourt', 'Residences', 2],
    [IMG.penthouse, 'Penthouse terrace with skyline views', 'Apartments', 3],
    [IMG.villa, 'Gated-community villa exterior', 'Residences', 4],
    [IMG.tea, 'Tea estate in the Nilgiri hills', 'Plantations', 5],
    [IMG.farmstead, 'Coconut farmstead at the Anamalai foothills', 'Farmlands', 6],
    [IMG.commercial, 'Commercial and IT office block', 'Commercial', 7],
    [IMG.showroom, 'Retail showroom frontage at dusk', 'Commercial', 8],
    [IMG.plots, 'Approved residential plot layout', 'Plots', 9],
    [IMG.office, 'Prime Estates consultation room', 'Workplace', 10],
  ];
  const galleryCount = (await one('SELECT COUNT(*)::int AS c FROM gallery_items'))?.c ?? 0;
  if (galleryCount === 0) {
    for (const [url, caption, category, sort_order] of galleryItems) {
      await query('INSERT INTO gallery_items (url, caption, category, sort_order) VALUES ($1,$2,$3,$4)', [url, caption, category, sort_order]);
    }
  }

  const total = (await one('SELECT COUNT(*)::int AS c FROM properties'))?.c ?? 0;
  return { skipped: false, properties: total };
}

// Allow `npm run seed` and `npm run seed -- --force`
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  seed({ force })
    .then((r) => { console.log('[seed]', r); process.exit(0); })
    .catch((e) => { console.error('[seed] failed', e); process.exit(1); });
}
