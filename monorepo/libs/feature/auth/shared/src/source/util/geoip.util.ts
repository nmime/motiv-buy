import * as geoip from 'geoip-lite';

export enum Continent {
  Europe = 'Europe',
  Asia = 'Asia',
  Africa = 'Africa',
  NorthAmerica = 'NorthAmerica',
  SouthAmerica = 'SouthAmerica',
  Oceania = 'Oceania',
}

export enum CountryCode {
  Ad = 'AD', // Andorra
  Ae = 'AE', // United Arab Emirates
  Af = 'AF', // Afghanistan
  Ag = 'AG', // Antigua and Barbuda
  Ai = 'AI', // Anguilla
  Al = 'AL', // Albania
  Am = 'AM', // Armenia
  Ao = 'AO', // Angola
  Aq = 'AQ', // Antarctica
  Ar = 'AR', // Argentina
  As = 'AS', // American Samoa
  At = 'AT', // Austria
  Au = 'AU', // Australia
  Aw = 'AW', // Aruba
  Ax = 'AX', // Åland Islands
  Az = 'AZ', // Azerbaijan
  Ba = 'BA', // Bosnia and Herzegovina
  Bb = 'BB', // Barbados
  Bd = 'BD', // Bangladesh
  Be = 'BE', // Belgium
  Bf = 'BF', // Burkina Faso
  Bg = 'BG', // Bulgaria
  Bh = 'BH', // Bahrain
  Bi = 'BI', // Burundi
  Bj = 'BJ', // Benin
  Bl = 'BL', // Saint Barthélemy
  Bm = 'BM', // Bermuda
  Bn = 'BN', // Brunei Darussalam
  Bo = 'BO', // Bolivia
  Bq = 'BQ', // Bonaire, Sint Eustatius and Saba
  Br = 'BR', // Brazil
  Bs = 'BS', // Bahamas
  Bt = 'BT', // Bhutan
  Bv = 'BV', // Bouvet Island
  Bw = 'BW', // Botswana
  By = 'BY', // Belarus
  Bz = 'BZ', // Belize
  Ca = 'CA', // Canada
  Cc = 'CC', // Cocos Islands
  Cd = 'CD', // Congo
  Cf = 'CF', // Central African Republic
  Cg = 'CG', // Congo
  Ch = 'CH', // Switzerland
  Ci = 'CI', // Côte d'Ivoire
  Ck = 'CK', // Cook Islands
  Cl = 'CL', // Chile
  Cm = 'CM', // Cameroon
  Cn = 'CN', // China
  Co = 'CO', // Colombia
  Cr = 'CR', // Costa Rica
  Cu = 'CU', // Cuba
  Cv = 'CV', // Cabo Verde
  Cw = 'CW', // Curaçao
  Cx = 'CX', // Christmas Island
  Cy = 'CY', // Cyprus
  Cz = 'CZ', // Czech Republic
  De = 'DE', // Germany
  Dj = 'DJ', // Djibouti
  Dk = 'DK', // Denmark
  Dm = 'DM', // Dominica
  Do = 'DO', // Dominican Republic
  Dz = 'DZ', // Algeria
  Ec = 'EC', // Ecuador
  Ee = 'EE', // Estonia
  Eg = 'EG', // Egypt
  Eh = 'EH', // Western Sahara
  Er = 'ER', // Eritrea
  Es = 'ES', // Spain
  Et = 'ET', // Ethiopia
  Fi = 'FI', // Finland
  Fj = 'FJ', // Fiji
  Fk = 'FK', // Falkland Islands
  Fm = 'FM', // Federated States of Micronesia
  Fo = 'FO', // Faroe Islands
  Fr = 'FR', // France
  Ga = 'GA', // Gabon
  Gb = 'GB', // United Kingdom of Great Britain and Northern Ireland
  Gd = 'GD', // Grenada
  Ge = 'GE', // Georgia
  Gf = 'GF', // French Guiana
  Gg = 'GG', // Guernsey
  Gh = 'GH', // Ghana
  Gi = 'GI', // Gibraltar
  Gl = 'GL', // Greenland
  Gm = 'GM', // Gambia
  Gn = 'GN', // Guinea
  Gp = 'GP', // Guadeloupe
  Gq = 'GQ', // Equatorial Guinea
  Gr = 'GR', // Greece
  Gs = 'GS', // South Georgia and the South Sandwich Islands
  Gt = 'GT', // Guatemala
  Gu = 'GU', // Guam
  Gw = 'GW', // Guinea-Bissau
  Gy = 'GY', // Guyana
  Hk = 'HK', // Hong Kong
  Hm = 'HM', // Heard Island and McDonald Islands
  Hn = 'HN', // Honduras
  Hr = 'HR', // Croatia
  Ht = 'HT', // Haiti
  Hu = 'HU', // Hungary
  Id = 'ID', // Indonesia
  Ie = 'IE', // Ireland
  Il = 'IL', // Israel
  Im = 'IM', // Isle of Man
  In = 'IN', // India
  Io = 'IO', // British Indian Ocean Territory
  Iq = 'IQ', // Iraq
  Ir = 'IR', // Islamic Republic of Iran
  Is = 'IS', // Iceland
  It = 'IT', // Italy
  Je = 'JE', // Jersey
  Jm = 'JM', // Jamaica
  Jo = 'JO', // Jordan
  Jp = 'JP', // Japan
  Ke = 'KE', // Kenya
  Kg = 'KG', // Kyrgyzstan
  Kh = 'KH', // Cambodia
  Ki = 'KI', // Kiribati
  Km = 'KM', // Comoros
  Kn = 'KN', // Saint Kitts and Nevis
  Kp = 'KP', // Democratic People's Republic of Korea
  Kr = 'KR', // Republic of Korea
  Kw = 'KW', // Kuwait
  Ky = 'KY', // Cayman Islands
  Kz = 'KZ', // Kazakhstan
  La = 'LA', // Lao People's Democratic Republic
  Lb = 'LB', // Lebanon
  Lc = 'LC', // Saint Lucia
  Li = 'LI', // Liechtenstein
  Lk = 'LK', // Sri Lanka
  Lr = 'LR', // Liberia
  Ls = 'LS', // Lesotho
  Lt = 'LT', // Lithuania
  Lu = 'LU', // Luxembourg
  Lv = 'LV', // Latvia
  Ly = 'LY', // Libya
  Ma = 'MA', // Morocco
  Mc = 'MC', // Monaco
  Md = 'MD', // Republic of Moldova
  Me = 'ME', // Montenegro
  Mf = 'MF', // Saint Martin
  Mg = 'MG', // Madagascar
  Mh = 'MH', // Marshall Islands
  Mk = 'MK', // Macedonia
  Ml = 'ML', // Mali
  Mm = 'MM', // Myanmar
  Mn = 'MN', // Mongolia
  Mo = 'MO', // Macao
  Mp = 'MP', // Northern Mariana Islands
  Mq = 'MQ', // Martinique
  Mr = 'MR', // Mauritania
  Ms = 'MS', // Montserrat
  Mt = 'MT', // Malta
  Mu = 'MU', // Mauritius
  Mv = 'MV', // Maldives
  Mw = 'MW', // Malawi
  Mx = 'MX', // Mexico
  My = 'MY', // Malaysia
  Mz = 'MZ', // Mozambique
  Na = 'NA', // Namibia
  Nc = 'NC', // New Caledonia
  Ne = 'NE', // Niger
  Nf = 'NF', // Norfolk Island
  Ng = 'NG', // Nigeria
  Ni = 'NI', // Nicaragua
  Nl = 'NL', // Netherlands
  No = 'NO', // Norway
  Np = 'NP', // Nepal
  Nr = 'NR', // Nauru
  Nu = 'NU', // Niue
  Nz = 'NZ', // New Zealand
  Om = 'OM', // Oman
  Pa = 'PA', // Panama
  Pe = 'PE', // Peru
  Pf = 'PF', // French Polynesia
  Pg = 'PG', // Papua New Guinea
  Ph = 'PH', // Philippines
  Pk = 'PK', // Pakistan
  Pl = 'PL', // Poland
  Pm = 'PM', // Saint Pierre and Miquelon
  Pn = 'PN', // Pitcairn
  Pr = 'PR', // Puerto Rico
  Ps = 'PS', // State of Palestine
  Pt = 'PT', // Portugal
  Pw = 'PW', // Palau
  Py = 'PY', // Paraguay
  Qa = 'QA', // Qatar
  Re = 'RE', // Réunion
  Ro = 'RO', // Romania
  Rs = 'RS', // Serbia
  Ru = 'RU', // Russian Federation
  Rw = 'RW', // Rwanda
  Sa = 'SA', // Saudi Arabia
  Sb = 'SB', // Solomon Islands
  Sc = 'SC', // Seychelles
  Sd = 'SD', // Sudan
  Se = 'SE', // Sweden
  Sg = 'SG', // Singapore
  Sh = 'SH', // Saint Helena, Ascension and Tristan da Cunha
  Si = 'SI', // Slovenia
  Sj = 'SJ', // Svalbard and Jan Mayen
  Sk = 'SK', // Slovakia
  Sl = 'SL', // Sierra Leone
  Sm = 'SM', // San Marino
  Sn = 'SN', // Senegal
  So = 'SO', // Somalia
  Sr = 'SR', // Suriname
  Ss = 'SS', // South Sudan
  St = 'ST', // Sao Tome and Principe
  Sv = 'SV', // El Salvador
  Sx = 'SX', // Sint Maarten
  Sy = 'SY', // Syrian Arab Republic
  Sz = 'SZ', // Swaziland
  Tc = 'TC', // Turks and Caicos Islands
  Td = 'TD', // Chad
  Tf = 'TF', // French Southern Territories
  Tg = 'TG', // Togo
  Th = 'TH', // Thailand
  Tj = 'TJ', // Tajikistan
  Tk = 'TK', // Tokelau
  Tl = 'TL', // Timor-Leste
  Tm = 'TM', // Turkmenistan
  Tn = 'TN', // Tunisia
  To = 'TO', // Tonga
  Tr = 'TR', // Turkey
  Tt = 'TT', // Trinidad and Tobago
  Tv = 'TV', // Tuvalu
  Tw = 'TW', // Taiwan, Province of China
  Tz = 'TZ', // United Republic of Tanzania
  Ua = 'UA', // Ukraine
  Ug = 'UG', // Uganda
  Um = 'UM', // United States Minor Outlying Islands
  Us = 'US', // United States of America
  Uy = 'UY', // Uruguay
  Uz = 'UZ', // Uzbekistan
  Va = 'VA', // Holy See
  Vc = 'VC', // Saint Vincent and the Grenadines
  Ve = 'VE', // Venezuela (Bolivarian Republic of)
  Vg = 'VG', // Virgin Islands
  Vi = 'VI', // Virgin Islands of the United States
  Vn = 'VN', // Viet Nam
  Vu = 'VU', // Vanuatu
  Wf = 'WF', // Wallis and Futuna
  Ws = 'WS', // Samoa
  Ye = 'YE', // Yemen
  Yt = 'YT', // Mayotte
  Za = 'ZA', // South Africa
  Zm = 'ZM', // Zambia
  Zw = 'ZW', // Zimbabwe
}

export const CountryNames: Record<CountryCode, string> = {
  [CountryCode.Ad]: 'Andorra',
  [CountryCode.Ae]: 'United Arab Emirates',
  [CountryCode.Af]: 'Afghanistan',
  [CountryCode.Ag]: 'Antigua and Barbuda',
  [CountryCode.Ai]: 'Anguilla',
  [CountryCode.Al]: 'Albania',
  [CountryCode.Am]: 'Armenia',
  [CountryCode.Ao]: 'Angola',
  [CountryCode.Aq]: 'Antarctica',
  [CountryCode.Ar]: 'Argentina',
  [CountryCode.As]: 'American Samoa',
  [CountryCode.At]: 'Austria',
  [CountryCode.Au]: 'Australia',
  [CountryCode.Aw]: 'Aruba',
  [CountryCode.Ax]: 'Åland Islands',
  [CountryCode.Az]: 'Azerbaijan',
  [CountryCode.Ba]: 'Bosnia and Herzegovina',
  [CountryCode.Bb]: 'Barbados',
  [CountryCode.Bd]: 'Bangladesh',
  [CountryCode.Be]: 'Belgium',
  [CountryCode.Bf]: 'Burkina Faso',
  [CountryCode.Bg]: 'Bulgaria',
  [CountryCode.Bh]: 'Bahrain',
  [CountryCode.Bi]: 'Burundi',
  [CountryCode.Bj]: 'Benin',
  [CountryCode.Bl]: 'Saint Barthélemy',
  [CountryCode.Bm]: 'Bermuda',
  [CountryCode.Bn]: 'Brunei',
  [CountryCode.Bo]: 'Bolivia',
  [CountryCode.Bq]: 'Bonaire, Sint Eustatius and Saba',
  [CountryCode.Br]: 'Brazil',
  [CountryCode.Bs]: 'Bahamas',
  [CountryCode.Bt]: 'Bhutan',
  [CountryCode.Bv]: 'Bouvet Island',
  [CountryCode.Bw]: 'Botswana',
  [CountryCode.By]: 'Belarus',
  [CountryCode.Bz]: 'Belize',
  [CountryCode.Ca]: 'Canada',
  [CountryCode.Cc]: 'Cocos Islands',
  [CountryCode.Cd]: 'Congo',
  [CountryCode.Cf]: 'Central African Republic',
  [CountryCode.Cg]: 'Congo',
  [CountryCode.Ch]: 'Switzerland',
  [CountryCode.Ci]: 'Ivory Coast',
  [CountryCode.Ck]: 'Cook Islands',
  [CountryCode.Cl]: 'Chile',
  [CountryCode.Cm]: 'Cameroon',
  [CountryCode.Cn]: 'China',
  [CountryCode.Co]: 'Colombia',
  [CountryCode.Cr]: 'Costa Rica',
  [CountryCode.Cu]: 'Cuba',
  [CountryCode.Cv]: 'Cape Verde',
  [CountryCode.Cw]: 'Curaçao',
  [CountryCode.Cx]: 'Christmas Island',
  [CountryCode.Cy]: 'Cyprus',
  [CountryCode.Cz]: 'Czech Republic',
  [CountryCode.De]: 'Germany',
  [CountryCode.Dj]: 'Djibouti',
  [CountryCode.Dk]: 'Denmark',
  [CountryCode.Dm]: 'Dominica',
  [CountryCode.Do]: 'Dominican Republic',
  [CountryCode.Dz]: 'Algeria',
  [CountryCode.Ec]: 'Ecuador',
  [CountryCode.Ee]: 'Estonia',
  [CountryCode.Eg]: 'Egypt',
  [CountryCode.Eh]: 'Western Sahara',
  [CountryCode.Er]: 'Eritrea',
  [CountryCode.Es]: 'Spain',
  [CountryCode.Et]: 'Ethiopia',
  [CountryCode.Fi]: 'Finland',
  [CountryCode.Fj]: 'Fiji',
  [CountryCode.Fk]: 'Falkland Islands',
  [CountryCode.Fm]: 'Micronesia',
  [CountryCode.Fo]: 'Faroe Islands',
  [CountryCode.Fr]: 'France',
  [CountryCode.Ga]: 'Gabon',
  [CountryCode.Gb]: 'United Kingdom',
  [CountryCode.Gd]: 'Grenada',
  [CountryCode.Ge]: 'Georgia',
  [CountryCode.Gf]: 'French Guiana',
  [CountryCode.Gg]: 'Guernsey',
  [CountryCode.Gh]: 'Ghana',
  [CountryCode.Gi]: 'Gibraltar',
  [CountryCode.Gl]: 'Greenland',
  [CountryCode.Gm]: 'Gambia',
  [CountryCode.Gn]: 'Guinea',
  [CountryCode.Gp]: 'Guadeloupe',
  [CountryCode.Gq]: 'Equatorial Guinea',
  [CountryCode.Gr]: 'Greece',
  [CountryCode.Gs]: 'South Georgia and the South Sandwich Islands',
  [CountryCode.Gt]: 'Guatemala',
  [CountryCode.Gu]: 'Guam',
  [CountryCode.Gw]: 'Guinea-Bissau',
  [CountryCode.Gy]: 'Guyana',
  [CountryCode.Hk]: 'Hong Kong',
  [CountryCode.Hm]: 'Heard Island and McDonald Islands',
  [CountryCode.Hn]: 'Honduras',
  [CountryCode.Hr]: 'Croatia',
  [CountryCode.Ht]: 'Haiti',
  [CountryCode.Hu]: 'Hungary',
  [CountryCode.Id]: 'Indonesia',
  [CountryCode.Ie]: 'Ireland',
  [CountryCode.Il]: 'Israel',
  [CountryCode.Im]: 'Isle of Man',
  [CountryCode.In]: 'India',
  [CountryCode.Io]: 'British Indian Ocean Territory',
  [CountryCode.Iq]: 'Iraq',
  [CountryCode.Ir]: 'Iran',
  [CountryCode.Is]: 'Iceland',
  [CountryCode.It]: 'Italy',
  [CountryCode.Je]: 'Jersey',
  [CountryCode.Jm]: 'Jamaica',
  [CountryCode.Jo]: 'Jordan',
  [CountryCode.Jp]: 'Japan',
  [CountryCode.Ke]: 'Kenya',
  [CountryCode.Kg]: 'Kyrgyzstan',
  [CountryCode.Kh]: 'Cambodia',
  [CountryCode.Ki]: 'Kiribati',
  [CountryCode.Km]: 'Comoros',
  [CountryCode.Kn]: 'Saint Kitts and Nevis',
  [CountryCode.Kp]: 'North Korea',
  [CountryCode.Kr]: 'South Korea',
  [CountryCode.Kw]: 'Kuwait',
  [CountryCode.Ky]: 'Cayman Islands',
  [CountryCode.Kz]: 'Kazakhstan',
  [CountryCode.La]: 'Laos',
  [CountryCode.Lb]: 'Lebanon',
  [CountryCode.Lc]: 'Saint Lucia',
  [CountryCode.Li]: 'Liechtenstein',
  [CountryCode.Lk]: 'Sri Lanka',
  [CountryCode.Lr]: 'Liberia',
  [CountryCode.Ls]: 'Lesotho',
  [CountryCode.Lt]: 'Lithuania',
  [CountryCode.Lu]: 'Luxembourg',
  [CountryCode.Lv]: 'Latvia',
  [CountryCode.Ly]: 'Libya',
  [CountryCode.Ma]: 'Morocco',
  [CountryCode.Mc]: 'Monaco',
  [CountryCode.Md]: 'Moldova',
  [CountryCode.Me]: 'Montenegro',
  [CountryCode.Mf]: 'Saint Martin',
  [CountryCode.Mg]: 'Madagascar',
  [CountryCode.Mh]: 'Marshall Islands',
  [CountryCode.Mk]: 'Macedonia',
  [CountryCode.Ml]: 'Mali',
  [CountryCode.Mm]: 'Myanmar',
  [CountryCode.Mn]: 'Mongolia',
  [CountryCode.Mo]: 'Macao',
  [CountryCode.Mp]: 'Northern Mariana Islands',
  [CountryCode.Mq]: 'Martinique',
  [CountryCode.Mr]: 'Mauritania',
  [CountryCode.Ms]: 'Montserrat',
  [CountryCode.Mt]: 'Malta',
  [CountryCode.Mu]: 'Mauritius',
  [CountryCode.Mv]: 'Maldives',
  [CountryCode.Mw]: 'Malawi',
  [CountryCode.Mx]: 'Mexico',
  [CountryCode.My]: 'Malaysia',
  [CountryCode.Mz]: 'Mozambique',
  [CountryCode.Na]: 'Namibia',
  [CountryCode.Nc]: 'New Caledonia',
  [CountryCode.Ne]: 'Niger',
  [CountryCode.Nf]: 'Norfolk Island',
  [CountryCode.Ng]: 'Nigeria',
  [CountryCode.Ni]: 'Nicaragua',
  [CountryCode.Nl]: 'Netherlands',
  [CountryCode.No]: 'Norway',
  [CountryCode.Np]: 'Nepal',
  [CountryCode.Nr]: 'Nauru',
  [CountryCode.Nu]: 'Niue',
  [CountryCode.Nz]: 'New Zealand',
  [CountryCode.Om]: 'Oman',
  [CountryCode.Pa]: 'Panama',
  [CountryCode.Pe]: 'Peru',
  [CountryCode.Pf]: 'French Polynesia',
  [CountryCode.Pg]: 'Papua New Guinea',
  [CountryCode.Ph]: 'Philippines',
  [CountryCode.Pk]: 'Pakistan',
  [CountryCode.Pl]: 'Poland',
  [CountryCode.Pm]: 'Saint Pierre and Miquelon',
  [CountryCode.Pn]: 'Pitcairn',
  [CountryCode.Pr]: 'Puerto Rico',
  [CountryCode.Ps]: 'Palestine',
  [CountryCode.Pt]: 'Portugal',
  [CountryCode.Pw]: 'Palau',
  [CountryCode.Py]: 'Paraguay',
  [CountryCode.Qa]: 'Qatar',
  [CountryCode.Re]: 'Réunion',
  [CountryCode.Ro]: 'Romania',
  [CountryCode.Rs]: 'Serbia',
  [CountryCode.Ru]: 'Russia',
  [CountryCode.Rw]: 'Rwanda',
  [CountryCode.Sa]: 'Saudi Arabia',
  [CountryCode.Sb]: 'Solomon Islands',
  [CountryCode.Sc]: 'Seychelles',
  [CountryCode.Sd]: 'Sudan',
  [CountryCode.Se]: 'Sweden',
  [CountryCode.Sg]: 'Singapore',
  [CountryCode.Sh]: 'Saint Helena, Ascension and Tristan da Cunha',
  [CountryCode.Si]: 'Slovenia',
  [CountryCode.Sj]: 'Svalbard and Jan Mayen',
  [CountryCode.Sk]: 'Slovakia',
  [CountryCode.Sl]: 'Sierra Leone',
  [CountryCode.Sm]: 'San Marino',
  [CountryCode.Sn]: 'Senegal',
  [CountryCode.So]: 'Somalia',
  [CountryCode.Sr]: 'Suriname',
  [CountryCode.Ss]: 'South Sudan',
  [CountryCode.St]: 'Sao Tome and Principe',
  [CountryCode.Sv]: 'El Salvador',
  [CountryCode.Sx]: 'Sint Maarten',
  [CountryCode.Sy]: 'Syria',
  [CountryCode.Sz]: 'Eswatini',
  [CountryCode.Tc]: 'Turks and Caicos Islands',
  [CountryCode.Td]: 'Chad',
  [CountryCode.Tf]: 'French Southern Territories',
  [CountryCode.Tg]: 'Togo',
  [CountryCode.Th]: 'Thailand',
  [CountryCode.Tj]: 'Tajikistan',
  [CountryCode.Tk]: 'Tokelau',
  [CountryCode.Tl]: 'Timor-Leste',
  [CountryCode.Tm]: 'Turkmenistan',
  [CountryCode.Tn]: 'Tunisia',
  [CountryCode.To]: 'Tonga',
  [CountryCode.Tr]: 'Turkey',
  [CountryCode.Tt]: 'Trinidad and Tobago',
  [CountryCode.Tv]: 'Tuvalu',
  [CountryCode.Tw]: 'Taiwan',
  [CountryCode.Tz]: 'Tanzania',
  [CountryCode.Ua]: 'Ukraine',
  [CountryCode.Ug]: 'Uganda',
  [CountryCode.Um]: 'United States Minor Outlying Islands',
  [CountryCode.Us]: 'United States',
  [CountryCode.Uy]: 'Uruguay',
  [CountryCode.Uz]: 'Uzbekistan',
  [CountryCode.Va]: 'Vatican City',
  [CountryCode.Vc]: 'Saint Vincent and the Grenadines',
  [CountryCode.Ve]: 'Venezuela',
  [CountryCode.Vg]: 'Virgin Islands',
  [CountryCode.Vi]: 'Virgin Islands of the United States',
  [CountryCode.Vn]: 'Vietnam',
  [CountryCode.Vu]: 'Vanuatu',
  [CountryCode.Wf]: 'Wallis and Futuna',
  [CountryCode.Ws]: 'Samoa',
  [CountryCode.Ye]: 'Yemen',
  [CountryCode.Yt]: 'Mayotte',
  [CountryCode.Za]: 'South Africa',
  [CountryCode.Zm]: 'Zambia',
  [CountryCode.Zw]: 'Zimbabwe',
};

const continentCountryCodesMapping: Record<Continent, CountryCode[]> = {
  [Continent.Africa]: [
    CountryCode.Dz,
    CountryCode.Ao,
    CountryCode.Bj,
    CountryCode.Bw,
    CountryCode.Bf,
    CountryCode.Bi,
    CountryCode.Cv,
    CountryCode.Cm,
    CountryCode.Cf,
    CountryCode.Td,
    CountryCode.Km,
    CountryCode.Cg,
    CountryCode.Cd,
    CountryCode.Dj,
    CountryCode.Eg,
    CountryCode.Gq,
    CountryCode.Er,
    CountryCode.Sz,
    CountryCode.Et,
    CountryCode.Ga,
    CountryCode.Gm,
    CountryCode.Gh,
    CountryCode.Gn,
    CountryCode.Gw,
    CountryCode.Ci,
    CountryCode.Ke,
    CountryCode.Ls,
    CountryCode.Lr,
    CountryCode.Ly,
    CountryCode.Mg,
    CountryCode.Mw,
    CountryCode.Ml,
    CountryCode.Mr,
    CountryCode.Mu,
    CountryCode.Ma,
    CountryCode.Mz,
    CountryCode.Na,
    CountryCode.Ne,
    CountryCode.Ng,
    CountryCode.Rw,
    CountryCode.St,
    CountryCode.Sn,
    CountryCode.Sc,
    CountryCode.Sl,
    CountryCode.So,
    CountryCode.Za,
    CountryCode.Ss,
    CountryCode.Sd,
    CountryCode.Tz,
    CountryCode.Tg,
    CountryCode.Tn,
    CountryCode.Ug,
    CountryCode.Zm,
    CountryCode.Zw,
    CountryCode.Yt,
    CountryCode.Re,
    CountryCode.Eh,
    CountryCode.Sh,
    CountryCode.Io,
  ],
  [Continent.Asia]: [
    CountryCode.Af,
    CountryCode.Am,
    CountryCode.Az,
    CountryCode.Bh,
    CountryCode.Bd,
    CountryCode.Bt,
    CountryCode.Bn,
    CountryCode.Mm,
    CountryCode.Kh,
    CountryCode.Cn,
    CountryCode.Cy,
    CountryCode.Ge,
    CountryCode.In,
    CountryCode.Id,
    CountryCode.Ir,
    CountryCode.Iq,
    CountryCode.Il,
    CountryCode.Jp,
    CountryCode.Jo,
    CountryCode.Kz,
    CountryCode.Kw,
    CountryCode.Kg,
    CountryCode.La,
    CountryCode.Lb,
    CountryCode.My,
    CountryCode.Mv,
    CountryCode.Mn,
    CountryCode.Np,
    CountryCode.Kp,
    CountryCode.Kr,
    CountryCode.Om,
    CountryCode.Pk,
    CountryCode.Ps,
    CountryCode.Ph,
    CountryCode.Qa,
    CountryCode.Sa,
    CountryCode.Sg,
    CountryCode.Lk,
    CountryCode.Sy,
    CountryCode.Tw,
    CountryCode.Tj,
    CountryCode.Th,
    CountryCode.Tr,
    CountryCode.Tm,
    CountryCode.Ae,
    CountryCode.Uz,
    CountryCode.Vn,
    CountryCode.Ye,
    CountryCode.Hk,
    CountryCode.Mo,
    CountryCode.Tl,
  ],
  [Continent.Europe]: [
    CountryCode.Al,
    CountryCode.Ad,
    CountryCode.At,
    CountryCode.By,
    CountryCode.Be,
    CountryCode.Ba,
    CountryCode.Bg,
    CountryCode.Hr,
    CountryCode.Cz,
    CountryCode.Dk,
    CountryCode.Ee,
    CountryCode.Fi,
    CountryCode.Fr,
    CountryCode.De,
    CountryCode.Gr,
    CountryCode.Hu,
    CountryCode.Is,
    CountryCode.Ie,
    CountryCode.It,
    CountryCode.Lv,
    CountryCode.Li,
    CountryCode.Lt,
    CountryCode.Lu,
    CountryCode.Mt,
    CountryCode.Md,
    CountryCode.Mc,
    CountryCode.Me,
    CountryCode.Nl,
    CountryCode.Mk,
    CountryCode.No,
    CountryCode.Pl,
    CountryCode.Pt,
    CountryCode.Ro,
    CountryCode.Ru,
    CountryCode.Sm,
    CountryCode.Rs,
    CountryCode.Sk,
    CountryCode.Si,
    CountryCode.Es,
    CountryCode.Se,
    CountryCode.Ch,
    CountryCode.Ua,
    CountryCode.Gb,
    CountryCode.Va,
    CountryCode.Ax,
    CountryCode.Gi,
    CountryCode.Gg,
    CountryCode.Im,
    CountryCode.Je,
    CountryCode.Fo,
    CountryCode.Sj,
  ],
  [Continent.NorthAmerica]: [
    CountryCode.Ag,
    CountryCode.Bs,
    CountryCode.Bb,
    CountryCode.Bz,
    CountryCode.Ca,
    CountryCode.Cr,
    CountryCode.Cu,
    CountryCode.Dm,
    CountryCode.Do,
    CountryCode.Sv,
    CountryCode.Gd,
    CountryCode.Gt,
    CountryCode.Ht,
    CountryCode.Hn,
    CountryCode.Jm,
    CountryCode.Mx,
    CountryCode.Ni,
    CountryCode.Pa,
    CountryCode.Kn,
    CountryCode.Lc,
    CountryCode.Vc,
    CountryCode.Tt,
    CountryCode.Us,
    CountryCode.Ai,
    CountryCode.Bm,
    CountryCode.Vg,
    CountryCode.Ky,
    CountryCode.Gl,
    CountryCode.Gp,
    CountryCode.Mq,
    CountryCode.Ms,
    CountryCode.Pm,
    CountryCode.Bl,
    CountryCode.Mf,
    CountryCode.Sx,
    CountryCode.Tc,
    CountryCode.Um,
    CountryCode.Vi,
    CountryCode.Pr,
  ],
  [Continent.SouthAmerica]: [
    CountryCode.Ar,
    CountryCode.Bo,
    CountryCode.Br,
    CountryCode.Cl,
    CountryCode.Co,
    CountryCode.Ec,
    CountryCode.Gy,
    CountryCode.Py,
    CountryCode.Pe,
    CountryCode.Sr,
    CountryCode.Uy,
    CountryCode.Ve,
    CountryCode.Aw,
    CountryCode.Bq,
    CountryCode.Cw,
    CountryCode.Fk,
    CountryCode.Gf,
    CountryCode.Gs,
  ],
  [Continent.Oceania]: [
    CountryCode.Au,
    CountryCode.Fj,
    CountryCode.Ki,
    CountryCode.Mh,
    CountryCode.Fm,
    CountryCode.Nr,
    CountryCode.Nz,
    CountryCode.Pw,
    CountryCode.Pg,
    CountryCode.Ws,
    CountryCode.Sb,
    CountryCode.To,
    CountryCode.Tv,
    CountryCode.Vu,
    CountryCode.As,
    CountryCode.Ck,
    CountryCode.Gu,
    CountryCode.Nc,
    CountryCode.Nu,
    CountryCode.Nf,
    CountryCode.Mp,
    CountryCode.Pf,
    CountryCode.Pn,
    CountryCode.Tk,
    CountryCode.Wf,
    CountryCode.Aq,
    CountryCode.Bv,
    CountryCode.Hm,
    CountryCode.Tf,
  ],
};

const getContinentByCountry = (countryCode: CountryCode): Continent | undefined => {
  for (const [continent, countryCodes] of Object.entries(continentCountryCodesMapping)) {
    if (countryCodes.includes(countryCode)) {
      return continent as Continent;
    }
  }
  return undefined;
};

export interface GeoLocation {
  continent?: string;
  country?: {
    code: string;
    name: string;
  };
  region?: string;
  city: string;
}

export const getGeoByIp = (ip: string | number): GeoLocation | undefined => {
  try {
    const geo = geoip.lookup(ip);
    if (!geo) {
      return undefined;
    }

    const countryCode = geo.country as CountryCode;
    const continent = getContinentByCountry(countryCode);

    return {
      continent,
      country: {
        code: geo.country,
        name: CountryNames[countryCode] || geo.country,
      },
      region: geo.region,
      city: geo.city,
    };
  } catch (error) {
    return undefined;
  }
};
