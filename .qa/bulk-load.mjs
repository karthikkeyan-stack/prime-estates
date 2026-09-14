// Loads synthetic properties to validate performance at 2,000+ scale.
// All rows are titled "Load Test ..." so they can be removed in one statement.
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const types=['apartment','villa','independent-house','plot','commercial','office','shop','showroom','investment','farmhouse'];
const listings=['sale','rent','lease'];
const statuses=['available','available','available','featured','sold','rented','draft'];
const locs=[['coimbatore','Coimbatore','Coimbatore'],['tirupur','Tirupur','Tirupur'],['pollachi','Pollachi','Coimbatore'],['ooty','Ooty','The Nilgiris'],['erode','Erode','Erode'],['palakkad','Palakkad','Palakkad']];
const areas=['Race Course','RS Puram','Peelamedu','Saravanampatti','Vadavalli','Singanallur','Ganapathy','Kovaipudur','Thudiyalur','Avinashi Road'];
const N=+(process.env.N||2200);
const t0=Date.now();
const c=await pool.connect();
await c.query('BEGIN');
for(let i=0;i<N;i++){
  const t=types[i%types.length], l=listings[i%3], st=statuses[i%statuses.length];
  const [lslug,lname,dist]=locs[i%locs.length];
  const price=(Math.floor(Math.random()*900)+25)*100000;
  const sqft=800+(i%40)*150;
  await c.query(
    `INSERT INTO properties (title,slug,property_type,listing_type,status,price,price_display,location,location_slug,area_locality,city,district,state,property_area,property_area_unit,built_up_area,bedrooms,bathrooms,parking,short_description,description,amenities,featured,published,main_image,seo_title,seo_description,views)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Tamil Nadu',$13,'sqft',$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     ON CONFLICT (slug) DO NOTHING`,
    [`Load Test Residence ${i+1}`,`load-test-residence-${i+1}`,t,l,st,price,
     price>=10000000?`₹${(price/10000000).toFixed(2)} Cr`:`₹${(price/100000).toFixed(0)} L`,
     lname,lslug,areas[i%areas.length],lname,dist,sqft,sqft-200,1+(i%5),1+(i%4),i%3,
     'Synthetic load-test record used to validate performance at scale.',
     'Synthetic load-test record. '.repeat(30),
     ['Lift','Power Backup','Security','Covered Parking','Club House'],
     st==='featured', st!=='draft', '/media/prop-kensington-manor.jpg',
     `Load Test Residence ${i+1}`,'Synthetic record.',Math.floor(Math.random()*500)]
  );
}
await c.query('COMMIT'); c.release();
console.log(`inserted ${N} in ${((Date.now()-t0)/1000).toFixed(1)}s`);
console.log('total properties:',(await pool.query('SELECT count(*) FROM properties')).rows[0].count);
await pool.end();
